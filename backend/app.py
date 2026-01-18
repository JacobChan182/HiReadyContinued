from flask import Flask, jsonify, request
from flask_cors import CORS
from twelvelabs import TwelveLabs
import os
from dotenv import load_dotenv
from backboard.client import BackboardClient
import asyncio
from pymongo import MongoClient
from datetime import datetime, UTC
import traceback
import time
from uuid import uuid4
from services.video_service import (
    start_video_indexing,
    index_and_segment,
    verify_index_configuration,
    wait_for_task_completion,
    segment_video_topics,
)
from twelvelabs.core.api_error import ApiError
from services.chat_router import (
    get_allowed_llms,
    get_routing_config,
    route_llm_for_message,
    validate_llm_choice,
)
import json

load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Allow all origins for development (adjust for prod)
    CORS(app)

    # When MongoDB is not configured, we still support multi-chat sessions during
    # this server process lifetime.
    in_memory_sessions = {
        "student": {},
        "instructor": {},
    }
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            response = jsonify({"status": "ok"})
            response.headers.add("Access-Control-Allow-Origin", "*")
            response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
            response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
            return response

    # In-memory fallback when MongoDB is not configured
    in_memory_sessions = {}

    # --- BEGIN: Mongo init ---
    MONGODB_URI = os.getenv("MONGODB_URI")
    if not MONGODB_URI:
        print("Warning: MONGODB_URI not set. Chat history will not be saved.")
        mongo_client = None
        db = None
        chat_db_student = None
        chat_db_instructor = None
    else:
        try:
            mongo_client = MongoClient(
                MONGODB_URI,
                tlsAllowInvalidCertificates=True
            )
            mongo_client.admin.command('ping')
            # Main DB (existing collections like rewind_events live here)

            # Chat DBs separated by role
            chat_db_student = mongo_client["no-more-tears-student"]
            chat_db_instructor = mongo_client["no-more-tears-instructor"]
            db = mongo_client["test"]
            print("✅ MongoDB connected successfully")
        except Exception as e:
            print(f"⚠️  MongoDB connection failed: {e}")
            print("⚠️  Chat history will not be saved.")
            mongo_client = None
            db = None
            chat_db_student = None
            chat_db_instructor = None

    def resolve_chat_role(value: str | None) -> str:
        role = (value or "student").strip().lower()
        if role not in {"student", "instructor"}:
            return "student"
        return role

    def get_chat_db(user_role: str | None):
        role = resolve_chat_role(user_role)
        if role == "instructor":
            return chat_db_instructor, role
        return chat_db_student, role
    # --- END: Mongo init ---

    # --- BEGIN: TwelveLabs init ---
    TWELVELABS_API_KEY = os.getenv("TWELVELABS_API_KEY")
    if not TWELVELABS_API_KEY:
        raise RuntimeError("Missing TWELVE_LABS_API_KEY env var")
    tl = TwelveLabs(api_key=TWELVELABS_API_KEY)
    # --- END: TwelveLabs init ---

    @app.post('/api/backboard/chat')
    def backboard_chat():
        data = request.get_json(force=True) or {}
        
        user_id = data.get("user_id")
        if not user_id:
            return {"status": "error", "message": "user_id is required"}, 400

        user_role = resolve_chat_role(data.get("user_role") or data.get("role"))
        chat_db, _ = get_chat_db(user_role)

        session_id = data.get("session_id") or str(uuid4())
        session_title = (
            data.get("title")
            or data.get("video_title")
            or data.get("lecture_id")
            or "Untitled"
        )
        
        api_key = os.getenv("BACKBOARD_API_KEY")
        if not api_key:
            return {"status": "error", "message": "Missing BACKBOARD_API_KEY env var"}, 500

        requested_provider = data.get("provider")
        requested_model = data.get("model")

        route_mode = (data.get("route_mode") or "auto").strip().lower()
        route_preset = (data.get("route_preset") or "auto").strip().lower()
        user_message = data.get("message", "")

        allowed = get_allowed_llms()
        routing_config = get_routing_config()
        default_provider = routing_config["DEFAULT_PROVIDER"]
        default_model = routing_config["DEFAULT_MODEL"]

        preset_choices = {"auto", "fastest", "logical", "everyday", "artistic"}
        if route_preset not in preset_choices:
            route_preset = "auto"

        # Default behavior: auto-route even if the client sends provider/model.
        # This avoids the frontend accidentally locking the backend to one model.
        if route_mode == "manual" and requested_provider and requested_model:
            provider, model, route_reason = (
                str(requested_provider).strip().lower(),
                str(requested_model).strip(),
                "bucket=manual",
            )
        elif route_preset == "fastest":
            provider, model, route_reason = (
                routing_config["FAST_PROVIDER"],
                routing_config["FAST_MODEL"],
                "bucket=fast_preset",
            )
        elif route_preset == "logical":
            provider, model, route_reason = (
                routing_config["LOGIC_PROVIDER"],
                routing_config["LOGIC_MODEL"],
                "bucket=logical_preset",
            )
        elif route_preset in {"everyday", "artistic"}:
            provider, model, route_reason = (
                default_provider,
                default_model,
                f"bucket={route_preset}_preset",
            )
        else:
            provider, model, route_reason = route_llm_for_message(
                user_message,
                context={
                    "lecture_id": data.get("lecture_id"),
                    "video_title": data.get("video_title"),
                    "title": data.get("title"),
                    "session_id": session_id,
                },
            )

        provider, model, fallback_note = validate_llm_choice(
            provider,
            model,
            allowed=allowed,
            fallback_provider=default_provider,
            fallback_model=default_model,
        )
        if fallback_note:
            route_reason = f"{route_reason};{fallback_note}"
        
        if provider not in allowed or model not in allowed[provider]:
            return {"status": "error", "message": "Unsupported provider/model"}, 400

        existing_session = None
        if chat_db is not None:
            existing_session = chat_db.chat_sessions.find_one(
                {"user_id": user_id, "session_id": session_id},
                {"_id": 0},
            )
        else:
            candidate = in_memory_sessions.get(user_role, {}).get(session_id)
            if candidate and candidate.get("user_id") == user_id:
                existing_session = candidate

        existing_assistant_id = (existing_session or {}).get("assistant_id")
        existing_thread_id = (existing_session or {}).get("thread_id")
        existing_title = (existing_session or {}).get("title")

        now = datetime.now(UTC)

        if chat_db is not None:
            chat_db.chat_messages.insert_one({
                "user_id": user_id,
                "user_role": user_role,
                "session_id": session_id,
                "role": "user",
                "content": user_message,
                "provider": provider,
                "model": model,
                "requested_provider": requested_provider,
                "requested_model": requested_model,
                "route_mode": route_mode,
                "route_preset": route_preset,
                "route_reason": route_reason,
                "timestamp": now,
            })

        async def run_chat(assistant_id, thread_id):
            client = BackboardClient(api_key=api_key)

            resolved_assistant_id = assistant_id
            resolved_thread_id = thread_id

            if not resolved_assistant_id or not resolved_thread_id:
                assistant = await client.create_assistant(
                    name="NoMoreTears Assistant",
                    description="A helpful educational assistant that helps students understand their lectures better",
                )
                thread = await client.create_thread(assistant.assistant_id)
                resolved_assistant_id = str(assistant.assistant_id)
                resolved_thread_id = str(thread.thread_id)

            selected_provider = provider
            selected_model = model
            selected_reason = route_reason

            try:
                response = await client.add_message(
                    thread_id=resolved_thread_id,
                    content=user_message,
                    llm_provider=selected_provider,
                    model_name=selected_model,
                    memory="Auto",
                    stream=False,
                )
                return (
                    resolved_assistant_id,
                    resolved_thread_id,
                    response.content,
                    selected_provider,
                    selected_model,
                    selected_reason,
                )
            except Exception as e:
                # Runtime fallback: if the chosen model/provider fails (timeouts,
                # transient provider issues), retry once with the default.
                if (
                    selected_provider == default_provider
                    and selected_model == default_model
                ):
                    raise

                print(
                    "⚠️  backboard primary model failed; retrying with default: "
                    f"primary={selected_provider}:{selected_model} default={default_provider}:{default_model} err={e}"
                )

                response = await client.add_message(
                    thread_id=resolved_thread_id,
                    content=user_message,
                    llm_provider=default_provider,
                    model_name=default_model,
                    memory="Auto",
                    stream=False,
                )
                fallback_reason = f"{selected_reason};runtime_fallback_from={selected_provider}:{selected_model}"
                return (
                    resolved_assistant_id,
                    resolved_thread_id,
                    response.content,
                    default_provider,
                    default_model,
                    fallback_reason,
                )

        try:
            start_time = time.monotonic()
            (
                resolved_assistant_id,
                resolved_thread_id,
                ai_response,
                used_provider,
                used_model,
                used_route_reason,
            ) = asyncio.run(
                run_chat(existing_assistant_id, existing_thread_id)
            )
            response_time_ms = int((time.monotonic() - start_time) * 1000)
        except Exception as e:
            print(
                "⚠️  backboard chat failed: "
                f"user_id={user_id} session_id={session_id} "
                f"route_mode={route_mode} "
                f"route_preset={route_preset} "
                f"requested={requested_provider}:{requested_model} "
                f"selected={provider}:{model} reason={route_reason} "
                f"err={e}"
            )
            return {"status": "error", "message": str(e)}, 500

        # The model/provider used may differ from the initially routed choice
        # if a runtime fallback was applied.
        provider = used_provider
        model = used_model
        route_reason = used_route_reason

        # Terminal visibility (VS Code): keep routing hidden in UI, but log it here.
        print(
            "ℹ️  backboard chat routed: "
            f"user_id={user_id} session_id={session_id} "
            f"route_mode={route_mode} "
            f"route_preset={route_preset} "
            f"requested={requested_provider}:{requested_model} "
            f"used={provider}:{model} reason={route_reason} "
            f"response_time_ms={response_time_ms}"
        )

        # Persist session + assistant response
        if db is not None:
            # Persist sessions in the chat DB, not the main DB
            chat_db_target, _ = get_chat_db(user_role)
            if chat_db_target is not None:
                resolved_title = existing_title or session_title
                chat_db_target.chat_sessions.update_one(
                {"user_id": user_id, "session_id": session_id},
                {
                    "$setOnInsert": {
                        "created_at": now,
                    },
                    "$set": {
                        "updated_at": now,
                            # Avoid clobbering an existing custom title when the
                            # client doesn't provide one on the first message.
                            "title": resolved_title,
                        "assistant_id": resolved_assistant_id,
                        "thread_id": resolved_thread_id,
                    },
                },
                upsert=True,
            )

            if chat_db_target is not None:
                chat_db_target.chat_messages.insert_one({
                "user_id": user_id,
                "user_role": user_role,
                "session_id": session_id,
                "role": "assistant",
                "content": ai_response,
                "provider": provider,
                "model": model,
                "requested_provider": requested_provider,
                "requested_model": requested_model,
                "route_mode": route_mode,
                "route_preset": route_preset,
                "route_reason": route_reason,
                "response_time_ms": response_time_ms,
                "assistant_id": resolved_assistant_id,
                "thread_id": resolved_thread_id,
                "timestamp": datetime.now(UTC),
            })
        else:
            in_memory_sessions.setdefault(user_role, {})[session_id] = {
                "user_id": user_id,
                "user_role": user_role,
                "session_id": session_id,
                "title": existing_title or session_title,
                "assistant_id": resolved_assistant_id,
                "thread_id": resolved_thread_id,
                "updated_at": now,
            }

        return jsonify({
            "response": ai_response,
            "session_id": session_id,
            "assistant_id": resolved_assistant_id,
            "thread_id": resolved_thread_id,
            "provider": provider,
            "model": model,
            "route_reason": route_reason,
            "response_time_ms": response_time_ms,
            "route_preset": route_preset,
        })

    @app.get('/api/backboard/chat/sessions/<user_id>')
    def list_chat_sessions(user_id):
        """List chat sessions for a user (used to support multiple chat topics)."""
        user_role = resolve_chat_role(request.args.get("user_role") or request.args.get("role"))
        chat_db, _ = get_chat_db(user_role)

        if chat_db is None:
            sessions = [
                {
                    "session_id": s.get("session_id"),
                    "title": s.get("title"),
                    "updated_at": s.get("updated_at"),
                }
                for s in in_memory_sessions.get(user_role, {}).values()
                if s.get("user_id") == user_id
            ]
            sessions.sort(key=lambda s: s.get("updated_at") or datetime.min, reverse=True)
            return jsonify({"status": "success", "user_id": user_id, "sessions": sessions})

        sessions = list(
            chat_db.chat_sessions.find({"user_id": user_id}, {"_id": 0})
            .sort("updated_at", -1)
            .limit(50)
        )
        return jsonify({"status": "success", "user_id": user_id, "sessions": sessions})

    @app.post('/api/backboard/chat/sessions')
    def create_chat_session():
        """Create a new empty chat session (topic) for a user."""
        body = request.get_json(force=True) or {}
        user_id = body.get("user_id")
        if not user_id:
            return {"status": "error", "message": "user_id is required"}, 400

        user_role = resolve_chat_role(body.get("user_role") or body.get("role"))
        chat_db, _ = get_chat_db(user_role)

        session_id = str(uuid4())
        title = body.get("title") or body.get("video_title") or body.get("lecture_id") or "New chat"
        if title == "New chat":
            title = "Untitled"
        now = datetime.now(UTC)

        session_doc = {
            "user_id": user_id,
            "user_role": user_role,
            "session_id": session_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
            "assistant_id": None,
            "thread_id": None,
        }

        if chat_db is not None:
            chat_db.chat_sessions.insert_one(session_doc)
        else:
            in_memory_sessions.setdefault(user_role, {})[session_id] = session_doc

        # PyMongo will add an ObjectId _id field to the inserted dict if it was
        # missing; Flask can't JSON-serialize ObjectId.
        session_doc.pop("_id", None)

        return jsonify({"status": "success", "session": session_doc})

    @app.delete('/api/backboard/chat/sessions/<user_id>/<session_id>')
    def delete_chat_session(user_id, session_id):
        """Delete a chat session and (if MongoDB is configured) its messages."""
        if not user_id or not session_id:
            return {"status": "error", "message": "user_id and session_id are required"}, 400

        user_role = resolve_chat_role(request.args.get("user_role") or request.args.get("role"))
        chat_db, _ = get_chat_db(user_role)

        if chat_db is None:
            existing = in_memory_sessions.get(user_role, {}).get(session_id)
            if not existing or existing.get("user_id") != user_id:
                return {"status": "error", "message": "Session not found"}, 404
            in_memory_sessions.get(user_role, {}).pop(session_id, None)
            return jsonify({"status": "success", "deleted": True, "session_id": session_id})

        # MongoDB-backed: delete both the session and all its messages
        session_result = chat_db.chat_sessions.delete_one({"user_id": user_id, "session_id": session_id})
        if session_result.deleted_count == 0:
            return {"status": "error", "message": "Session not found"}, 404

        chat_db.chat_messages.delete_many({"user_id": user_id, "session_id": session_id})

        return jsonify({"status": "success", "deleted": True, "session_id": session_id})

    @app.get('/api/backboard/chat/history/<user_id>')
    def get_chat_history(user_id):
        """Get chat history for a specific user"""
        user_role = resolve_chat_role(request.args.get("user_role") or request.args.get("role"))
        chat_db, _ = get_chat_db(user_role)

        if chat_db is None:
            return {"status": "error", "message": "MongoDB not configured"}, 500
        
        limit = request.args.get('limit', 50, type=int)
        skip = request.args.get('skip', 0, type=int)

        session_id = request.args.get('session_id')

        query = {"user_id": user_id}
        if session_id:
            query["session_id"] = session_id
        
        messages = list(chat_db.chat_messages.find(
            query,
            {"_id": 0}  
        ).sort("timestamp", -1).skip(skip).limit(limit))
        
        messages.reverse()
        
        return jsonify({
            "status": "success",
            "user_id": user_id,
            "messages": messages,
            "count": len(messages)
        })

    @app.post('/api/backboard/analyze-video')
    def analyze_video():
        """Analyze video engagement data to find where students struggle"""
        data = request.get_json(force=True)
        
        video_id = data.get("video_id")
        video_title = data.get("video_title", "")
        analysis_prompt = data.get("prompt", "Analyze where students are struggling in this video")
        
        if not video_id:
            return {"status": "error", "message": "video_id is required"}, 400

        # Pull rewind/interactions from MongoDB (if available) so the endpoint can
        # still return useful analytics even when the LLM call fails.
        if db is not None:
            interactions = list(
                db.rewind_events.find({"video_id": video_id}, {"_id": 0}).limit(1000)
            )
        else:
            interactions = []

        def compute_basic_analytics(events):
            total_events = len(events)
            user_ids = set()
            concept_counts = {}
            segments = []

            for e in events:
                uid = e.get("user_id") or e.get("studentId") or e.get("student_id")
                if uid:
                    user_ids.add(str(uid))

                concept_name = (
                    e.get("fromConceptName")
                    or e.get("toConceptName")
                    or e.get("conceptName")
                )
                if concept_name:
                    concept_counts[concept_name] = concept_counts.get(concept_name, 0) + 1

                start_time = e.get("fromTime") or e.get("startTime")
                end_time = e.get("toTime") or e.get("endTime")
                if isinstance(start_time, (int, float)) and isinstance(end_time, (int, float)):
                    segments.append(
                        {
                            "startTime": float(min(start_time, end_time)),
                            "endTime": float(max(start_time, end_time)),
                            "name": concept_name or "Segment",
                            "rewindCount": 1,
                        }
                    )

            total_students = len(user_ids)
            average_rewinds = (total_events / total_students) if total_students else 0

            rewind_frequency = [
                {"conceptName": name, "rewindCount": count}
                for name, count in sorted(concept_counts.items(), key=lambda kv: kv[1], reverse=True)[:12]
            ]

            return {
                "totalStudents": total_students,
                "averageRewindCount": average_rewinds,
                "rewindFrequency": rewind_frequency,
                "strugglingSegments": segments[:25],
            }

        analytics = compute_basic_analytics(interactions)
        
        api_key = os.getenv("BACKBOARD_API_KEY")
        # If the LLM key is missing, still return the computed analytics.
        if not api_key:
            return jsonify({
                "status": "success",
                "video_id": video_id,
                "analytics": analytics,
                "analysis": None,
                "note": "Missing BACKBOARD_API_KEY env var; returned database-derived analytics only"
            })

        # Define tools the AI can call
        tools = [{
            "type": "function",
            "function": {
                "name": "get_video_rewind_data",
                "description": "Get rewind/replay events for a video from the database",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "video_id": {"type": "string", "description": "The video ID to fetch data for"}
                    },
                    "required": ["video_id"]
                }
            }
        }]

        async def run_analysis():
            client = BackboardClient(api_key=api_key)

            assistant = await client.create_assistant(
                name="Video Analysis Assistant",
                description=(
                    "An expert educational video analyst that analyzes student engagement patterns "
                    "to identify difficult sections and provide actionable insights"
                ),
                tools=tools,
            )
            thread = await client.create_thread(assistant.assistant_id)

            full_prompt = f"""
{analysis_prompt}

Video ID: {video_id}
Video Title: {video_title}

Known aggregated analytics (database-derived):
{analytics}

Use the get_video_rewind_data tool to fetch raw interaction data if needed, then provide insights.
"""

            response = await client.add_message(
                thread_id=thread.thread_id,
                content=full_prompt,
                llm_provider="openai",
                model_name="gpt-4o",
                stream=False,
            )

            if response.status == "REQUIRES_ACTION" and response.tool_calls:
                tool_outputs = []

                for tc in response.tool_calls:
                    if tc.function.name == "get_video_rewind_data":
                        tool_outputs.append({
                            "tool_call_id": tc.id,
                            "output": str(interactions),
                        })

                final_response = await client.submit_tool_outputs(
                    thread_id=thread.thread_id,
                    run_id=response.run_id,
                    tool_outputs=tool_outputs,
                )
                return assistant.assistant_id, thread.thread_id, final_response.content

            return assistant.assistant_id, thread.thread_id, response.content

        try:
            assistant_id, thread_id, analysis = asyncio.run(run_analysis())
        except Exception as e:
            print(f"⚠️  analyze-video LLM call failed: {e}")
            assistant_id = None
            thread_id = None
            analysis = None

        assistant_id_str = str(assistant_id) if assistant_id is not None else None
        thread_id_str = str(thread_id) if thread_id is not None else None

        # Save analysis to MongoDB
        if db is not None:
            try:
                db.video_analyses.insert_one({
                    "video_id": video_id,
                    "video_title": video_title,
                    "analysis": analysis,
                    "analytics": analytics,
                    "assistant_id": assistant_id_str,
                    "thread_id": thread_id_str,
                    "timestamp": datetime.now(UTC)
                })
            except Exception as e:
                print(f"⚠️  Failed to persist video analysis: {e}")

        return jsonify({
            "status": "success",
            "video_id": video_id,
            "analytics": analytics,
            "analysis": analysis,
            "assistant_id": assistant_id_str,
            "thread_id": thread_id_str,
        })

    # Generate educational content (quiz/summary)
    @app.post('/api/backboard/generate-content')
    async def generate_educational_content():
        raw_data = request.get_data(as_text=True)
        print(f"\n📥 RAW INCOMING DATA: {raw_data}")

        try:
            data = request.get_json(force=True)
            print(f"📦 PARSED JSON: {data}")
        except Exception as e:
            print(f"❌ JSON PARSE ERROR: {e}")
            traceback.print_exc()
            return jsonify({"status": "error", "message": "Invalid JSON"}), 400

        lecture_id = data.get("lecture_id")
        video_id = data.get("video_id")
        video_title = data.get("video_title", "Untitled Lecture")
        content_type = data.get("content_type", "quiz")
        topics = data.get("topics", [])

        print(f"🔎 Extracted lecture_id: {lecture_id}")
        print(f"🔎 Extracted video_id: {video_id}")
        print(f"🔎 Extracted video_title: {video_title}")

        # Build topics context
        topics_text = None
        if not topics and lecture_id:
            try:
                from services.data_service import get_segments_for_quiz
                topics_text = get_segments_for_quiz(db, lecture_id)
                preview = topics_text[:200] + "…" if isinstance(topics_text, str) and len(topics_text) > 200 else topics_text
                print(f"📄 Topics from DB: {preview}")
            except Exception as e:
                print(f"❌ Error fetching segments: {e}")
                traceback.print_exc()
                topics_text = f"Error fetching lecture content: {str(e)}"
        elif topics:
            topics_text = "\n\n".join([
                f"Topic: {t.get('title')}\nDescription: {t.get('description')}"
                for t in topics
            ])

        # Validate content context
        invalid_markers = (
            "No content found",
            "No lecture ID",
            "Database not connected",
            "Error",
            "ERROR:",  # NEW: catch explicit error messages
            "TwelveLabs data is still processing",  # NEW
            "No segments found for lecture",        # NEW
        )
        if not topics_text or any(m in topics_text for m in invalid_markers):
            error_msg = topics_text if topics_text else "No content found"
            print(f"❌ Content error: {error_msg}")
            return jsonify({"status": "error", "message": error_msg}), 400

        api_key = os.getenv("BACKBOARD_API_KEY")
        if not api_key:
            print("❌ Missing BACKBOARD_API_KEY")
            return jsonify({"status": "error", "message": "Missing BACKBOARD_API_KEY"}), 500

        # System prompt/task
        if content_type == "quiz":
            system_prompt = "You are an expert educational content creator."
            task = "Generate 3-5 multiple choice quiz questions. Include answers."
        elif content_type == "summary":
            system_prompt = "You are an expert summarizer."
            task = "Create a concise summary."
        else:
            system_prompt = "You are a helpful tutor."
            task = "Provide study tips."

        full_prompt = f"Video: {video_title}\n\nTopics:\n{topics_text}\n\nTask: {task}"

        # Call Backboard
        async def run_generation():
            client = BackboardClient(api_key=api_key)
            assistant = await client.create_assistant(
                name="Educational Content Generator",
                description=system_prompt,
            )
            thread = await client.create_thread(assistant.assistant_id)
            response = await client.add_message(
                thread_id=thread.thread_id,
                content=full_prompt,
                llm_provider="openai",
                model_name="gpt-4o",
                stream=False,
            )
            return assistant, thread, response

        try:
            assistant, thread, response = await run_generation()
        except Exception as e:
            print(f"❌ Generation error: {e}")
            traceback.print_exc()
            return jsonify({"status": "error", "message": str(e)}), 500

        generated_content = response.content

        # Persist to Mongo (optional)
        if db is not None:
            try:
                db.generated_content.insert_one({
                    "lecture_id": lecture_id,
                    "video_id": video_id,
                    "video_title": video_title,
                    "content_type": content_type,
                    "content": generated_content,
                    "timestamp": datetime.now(UTC)
                })
            except Exception as e:
                print(f"⚠️ Failed to persist generated content: {e}")

        return jsonify({
            "status": "success",
            "content": generated_content,
            "thread_id": str(thread.thread_id)
        })

    @app.post('/api/index-video')
    def index_video():
        data = request.get_json(force=True) or {}
        video_url = data.get("videoUrl") or data.get("video_url")
        lecture_id = data.get("lectureId") or data.get("lecture_id")

        if not video_url:
            return jsonify({"status": "error", "message": "videoUrl is required"}), 400

        try:
            task_id = start_video_indexing(video_url)
            if not task_id:
                return jsonify({"status": "error", "message": "Failed to start indexing"}), 500

            return jsonify({
                "status": "success",
                "task_id": task_id,
                "lecture_id": lecture_id,
            })
        except ApiError as e:
            status_code = getattr(e, "status_code", 500) or 500
            headers = getattr(e, "headers", {}) or {}
            body = getattr(e, "body", {}) or {}
            retry_after = headers.get("retry-after") if status_code == 429 else None
            message = body.get("message") or "Upstream error"

            payload = {
                "status": "error",
                "message": message,
            }
            if retry_after is not None:
                payload["retry_after"] = retry_after

            return jsonify(payload), status_code
        except Exception as e:
            traceback.print_exc()
            return jsonify({"status": "error", "message": str(e)}), 500

    @app.post('/api/segment-video')
    def segment_video():
        data = request.get_json(force=True) or {}
        video_url = data.get("videoUrl") or data.get("video_url")
        lecture_id = data.get("lectureId") or data.get("lecture_id")
        video_id = data.get("videoId") or data.get("video_id")
        task_id = data.get("taskId") or data.get("task_id")

        try:
            if not video_id:
                if task_id:
                    video_id = wait_for_task_completion(task_id)
                elif video_url:
                    task_id = start_video_indexing(video_url)
                    if not task_id:
                        return jsonify({"status": "error", "message": "Failed to start indexing"}), 500
                    video_id = wait_for_task_completion(task_id)

            if not video_id:
                return jsonify({"status": "error", "message": "Failed to resolve video_id"}), 500

            raw_data = segment_video_topics(video_id)
            segments = (raw_data or {}).get("segments", [])

            return jsonify({
                "status": "success",
                "lecture_id": lecture_id,
                "video_id": video_id,
                "segments": segments,
                "rawAiMetaData": raw_data,
            })
        except ApiError as e:
            status_code = getattr(e, "status_code", 500) or 500
            headers = getattr(e, "headers", {}) or {}
            body = getattr(e, "body", {}) or {}
            retry_after = headers.get("retry-after") if status_code == 429 else None
            message = body.get("message") or "Upstream error"

            payload = {
                "status": "error",
                "message": message,
            }
            if retry_after is not None:
                payload["retry_after"] = retry_after

            return jsonify(payload), status_code
        except Exception as e:
            traceback.print_exc()
            return jsonify({"status": "error", "message": str(e)}), 500

    # Simple health check
    @app.get("/health")
    def health():
        return {"status": "ok", "server": "Flask"}, 200

    # ...existing routes remain unchanged...

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("FLASK_PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=True)
