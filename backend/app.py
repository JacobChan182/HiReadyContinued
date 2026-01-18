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
from services.video_service import start_video_indexing, index_and_segment, verify_index_configuration

load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app)

    MONGODB_URI = os.getenv("MONGODB_URI")
    if not MONGODB_URI:
        print("Warning: MONGODB_URI not set. Chat history will not be saved.")
        mongo_client = None
        db = None
    else:
        try:
            mongo_client = MongoClient(
                MONGODB_URI,
                tlsAllowInvalidCertificates=True
            )
            
            mongo_client.admin.command('ping')
            db = mongo_client["no-more-tears"] 
            print("✅ MongoDB connected successfully")
        except Exception as e:
            print(f"⚠️  MongoDB connection failed: {e}")
            print("⚠️  Chat history will not be saved.")
            mongo_client = None
            db = None

    # Initialize Twelve Labs client
    TWELVELABS_API_KEY = os.getenv("TWELVELABS_API_KEY")
    if not TWELVELABS_API_KEY:
        raise RuntimeError("Missing TWELVE_LABS_API_KEY env var")
    tl = TwelveLabs(api_key=TWELVELABS_API_KEY)

    @app.post('/api/backboard/chat')
    def backboard_chat():
        data = request.get_json(force=True)
        
        user_id = data.get("user_id")
        if not user_id:
            return {"status": "error", "message": "user_id is required"}, 400
        
        api_key = os.getenv("BACKBOARD_API_KEY")
        if not api_key:
            return {"status": "error", "message": "Missing BACKBOARD_API_KEY env var"}, 500

        client = BackboardClient(api_key=api_key)

        provider = data.get("provider", "openai")
        model = data.get("model", "gpt-4o")
        user_message = data.get("message", "")
        
        allowed = {
            "openai": {"gpt-5", "gpt-4o", "gpt-4o-mini"},
            "anthropic": {"claude-3.5-sonnet"},
            "mistral": {"mistral-large-latest"},
        }
        if provider not in allowed or model not in allowed[provider]:
            return {"status": "error", "message": "Unsupported provider/model"}, 400

        if db is not None:
            db.chat_messages.insert_one({
                "user_id": user_id,
                "role": "user",
                "content": user_message,
                "provider": provider,
                "model": model,
                "timestamp": datetime.now(UTC)
            })

        # Run all async operations in a single event loop
        async def run_chat():
            assistant = await client.create_assistant(
                name="NoMoreTears Assistant",
                description="A helpful educational assistant that helps students understand their lectures better"
            )
            thread = await client.create_thread(assistant.assistant_id)

            response = await client.add_message(
                thread_id=thread.thread_id,
                content=user_message,
                llm_provider=provider,
                model_name=model,
                memory="Auto",
                stream=False
            )
            
            return assistant, thread, response

        assistant, thread, response = asyncio.run(run_chat())
        ai_response = response.content

        # Save AI response to MongoDB
        if db is not None:
            db.chat_messages.insert_one({
                "user_id": user_id,
                "role": "assistant",
                "content": ai_response,
                "provider": provider,
                "model": model,
                "assistant_id": str(assistant.assistant_id),
                "thread_id": str(thread.thread_id),
                "timestamp": datetime.now(UTC)
            })

        return jsonify({
            "response": ai_response,
            "assistant_id": str(assistant.assistant_id),
            "thread_id": str(thread.thread_id)
        })

    @app.get('/api/backboard/chat/history/<user_id>')
    def get_chat_history(user_id):
        """Get chat history for a specific user"""
        if db is None:
            return {"status": "error", "message": "MongoDB not configured"}, 500
        
        limit = request.args.get('limit', 50, type=int)
        skip = request.args.get('skip', 0, type=int)
        
        messages = list(db.chat_messages.find(
            {"user_id": user_id},
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

    @app.post('/api/backboard/generate-content')
    def generate_educational_content():
        """Generate educational content (quizzes, summaries, etc.) from video topics"""
        data = request.get_json(force=True)
        
        video_id = data.get("video_id")
        video_title = data.get("video_title", "")
        topics = data.get("topics", [])
        content_type = data.get("content_type", "quiz")
        
        if not video_id or not topics:
            return {"status": "error", "message": "video_id and topics are required"}, 400
        
        api_key = os.getenv("BACKBOARD_API_KEY")
        if not api_key:
            return {"status": "error", "message": "Missing BACKBOARD_API_KEY env var"}, 500

        if content_type == "quiz":
            system_prompt = "You are an expert educational content creator. Generate practice quiz questions based on video topics."
            task = "Generate 3-5 multiple choice quiz questions for each topic. Include answers and explanations."
        elif content_type == "summary":
            system_prompt = "You are an expert educational content creator. Create clear topic summaries for students."
            task = "Create a concise summary for each topic that highlights key concepts and learning objectives."
        elif content_type == "help":
            system_prompt = "You are a helpful tutor. Provide topic breakdowns and study tips."
            task = "For each topic, provide a brief explanation and suggest what students should focus on."
        else:
            return {"status": "error", "message": "Invalid content_type. Use 'quiz', 'summary', or 'help'"}, 400

        # Format topics for the AI
        topics_text = "\n\n".join([
            f"Topic {i+1}: {topic.get('title', 'Untitled')}\n"
            f"Time: {topic.get('start_time', 0)}s - {topic.get('end_time', 0)}s\n"
            f"Description: {topic.get('description', 'No description')}"
            for i, topic in enumerate(topics)
        ])

        full_prompt = f"""
Video: {video_title} (ID: {video_id})

Topics from video:
{topics_text}

Task: {task}
"""

        client = BackboardClient(api_key=api_key)

        async def run_generation():
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

        assistant, thread, response = asyncio.run(run_generation())
        generated_content = response.content

        # Save to MongoDB
        if db is not None:
            db.generated_content.insert_one({
                "video_id": video_id,
                "video_title": video_title,
                "content_type": content_type,
                "content": generated_content,
                "topics": topics,
                "timestamp": datetime.now(UTC)
            })

        return jsonify({
            "status": "success",
            "video_id": video_id,
            "content_type": content_type,
            "content": generated_content,
            "assistant_id": str(assistant.assistant_id),
            "thread_id": str(thread.thread_id)
        })

    @app.get("/health")
    def health():
        return {"status": "ok", "server": "Flask"}, 200

    @app.route('/api/hello', methods=['GET'])
    def test():
        return {"status": "success"}

    @app.route('/api/test-connection', methods=['GET'])
    def test_connection():
        try:
            indexes = list(tl.indexes.list())
            return {"status": "connected", "index_count": len(indexes)}, 200
        except Exception as e:
            return {"status": "error", "message": str(e)}, 500
        
    @app.route('/api/index-video', methods=['POST'])
    def handle_index_request():
        try:
            data = request.json
            print(f"[Flask] /api/index-video payload: {data}")
            video_url = data.get('videoUrl')
            lecture_id = data.get('lectureId')

            if not video_url:
                return jsonify({"error": "No video URL provided"}), 400

            # Trigger the Twelve Labs indexing process
            task_id = start_video_indexing(video_url)
            
            if task_id:
                print(f"[Flask] Indexing task started: task_id={task_id} lectureId={lecture_id}")
                return jsonify({
                    "success": True, 
                    "message": "Indexing task created", 
                    "task_id": task_id
                }), 202
            else:
                print(f"[Flask] Failed to start indexing for lectureId={lecture_id}")
                return jsonify({"error": "Failed to start indexing"}), 500
        
        except Exception as e:
            print(f"[Flask] CRITICAL ROUTE ERROR: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route("/api/segment-video", methods=["POST"])
    def segment_video():
        try:
            body = request.get_json(force=True) or {}
            video_url = body.get("videoUrl")
            lecture_id = body.get("lectureId")
            if not video_url:
                return jsonify({"error": "videoUrl is required"}), 400
            print(f"[Flask] /api/segment-video lectureId={lecture_id} started")

            # 1. This returns a full object (including a "segments" list)
            result = index_and_segment(video_url)

            # 2. Extract the list for loop/logging
            segments_list = result.get("segments", [])

            print(f"[Flask] /api/segment-video lectureId={lecture_id} finished -> {len(segments_list)} segments")
            
            # 3. Use the list for the loop
            for i, s in enumerate(segments_list[:5]):
                print(f"[Flask][{i}] {s.get('start')} - {s.get('end')} :: {s.get('title')}")

            # 4. Return to Express (and keep full metadata for Mongo)
            return jsonify({
                "lectureId": lecture_id, 
                "segments": segments_list,
                "rawAiMetaData": result
            }), 200

        except Exception as e:
            print(f"[Flask] segmentation error: {e}")
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    @app.route("/api/task-status", methods=["GET"])
    def task_status():
        try:
            task_id = request.args.get("taskId")
            if not task_id:
                return jsonify({"error": "taskId is required"}), 400
            task = tl.tasks.retrieve(task_id)
            return jsonify({
                "taskId": task_id,
                "status": getattr(task, "status", None),
                "assetId": getattr(task, "asset_id", None),
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("FLASK_PORT", "5001"))  # Changed default from 5000 to 5001 to avoid AirPlay conflict
    app.run(host="0.0.0.0", port=port, debug=True)
