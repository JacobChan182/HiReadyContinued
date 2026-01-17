from flask import Flask, jsonify, request
from flask_cors import CORS
from twelvelabs import TwelveLabs
import os
from dotenv import load_dotenv
from backboard import BackboardClient
import asyncio
from pymongo import MongoClient
from datetime import datetime
from services.video_service import start_video_indexing

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
        mongo_client = MongoClient(MONGODB_URI)
        db = mongo_client["no-more-tears"] 
        print("✅ MongoDB connected successfully")

    TL_API_KEY = os.getenv("TL_API_KEY")
    if not TL_API_KEY:
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
                "timestamp": datetime.utcnow()
            })

        # Create assistant and thread, then send the message with memory enabled
        assistant = asyncio.run(client.create_assistant(
            name="NoMoreTears Assistant",
            system_prompt="You are a helpful educational assistant that helps students understand their lectures better"
        ))
        thread = asyncio.run(client.create_thread(assistant.assistant_id))

        # Send message with memory="Auto" to enable persistent context
        response = asyncio.run(client.add_message(
            thread_id=thread.thread_id,
            content=user_message,
            llm_provider=provider,
            model_name=model,
            memory="Auto",  # Enable memory across conversations
            stream=False
        ))

        ai_response = response.content

        # Save AI response to MongoDB
        if db is not None:
            db.chat_messages.insert_one({
                "user_id": user_id,
                "role": "assistant",
                "content": ai_response,
                "provider": provider,
                "model": model,
                "assistant_id": assistant.assistant_id,
                "thread_id": thread.thread_id,
                "timestamp": datetime.utcnow()
            })

        return jsonify({
            "response": ai_response,
            "assistant_id": assistant.assistant_id,
            "thread_id": thread.thread_id
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
        
        api_key = os.getenv("BACKBOARD_API_KEY")
        if not api_key:
            return {"status": "error", "message": "Missing BACKBOARD_API_KEY env var"}, 500

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

        client = BackboardClient(api_key=api_key)

        # Create assistant with tools
        assistant = asyncio.run(client.create_assistant(
            name="Video Analysis Assistant",
            system_prompt="You are an expert educational video analyst. Analyze student engagement patterns to identify difficult sections and provide actionable insights.",
            tools=tools
        ))
        thread = asyncio.run(client.create_thread(assistant.assistant_id))

        # Send initial analysis request
        full_prompt = f"""
{analysis_prompt}

Video ID: {video_id}
Video Title: {video_title}

Use the get_video_rewind_data tool to fetch student interaction data, then analyze it.
"""

        response = asyncio.run(client.add_message(
            thread_id=thread.thread_id,
            content=full_prompt,
            llm_provider="openai",
            model_name="gpt-4o",
            stream=False
        ))

        # Check if AI wants to call a tool
        if response.status == "REQUIRES_ACTION" and response.tool_calls:
            tool_outputs = []
            
            for tc in response.tool_calls:
                if tc.function.name == "get_video_rewind_data":
                    # Fetch actual data from MongoDB
                    if db is not None:
                        interactions = list(db.rewind_events.find(
                            {"video_id": video_id},
                            {"_id": 0}
                        ).limit(100))
                    else:
                        interactions = []
                    
                    tool_outputs.append({
                        "tool_call_id": tc.id,
                        "output": str(interactions)  # Convert to string for AI
                    })
            
            # Submit tool outputs and get final response
            final_response = asyncio.run(client.submit_tool_outputs(
                thread_id=thread.thread_id,
                run_id=response.run_id,
                tool_outputs=tool_outputs
            ))
            
            analysis = final_response.content
        else:
            analysis = response.content

        # Save analysis to MongoDB
        if db is not None:
            db.video_analyses.insert_one({
                "video_id": video_id,
                "video_title": video_title,
                "analysis": analysis,
                "timestamp": datetime.utcnow()
            })

        return jsonify({
            "status": "success",
            "video_id": video_id,
            "analysis": analysis
        })

    @app.post('/api/backboard/generate-content')
    def generate_educational_content():
        """Generate educational content (quizzes, summaries, etc.) from video topics"""
        data = request.get_json(force=True)
        
        video_id = data.get("video_id")
        video_title = data.get("video_title", "")
        topics = data.get("topics", [])  # Segmented topics from TwelveLabs
        content_type = data.get("content_type", "quiz")  # "quiz", "summary", "help"
        
        if not video_id or not topics:
            return {"status": "error", "message": "video_id and topics are required"}, 400
        
        api_key = os.getenv("BACKBOARD_API_KEY")
        if not api_key:
            return {"status": "error", "message": "Missing BACKBOARD_API_KEY env var"}, 500

        # Build prompt based on content type
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

        # Create assistant for content generation
        assistant = asyncio.run(client.create_assistant(
            name="Educational Content Generator",
            system_prompt=system_prompt
        ))
        thread = asyncio.run(client.create_thread(assistant.assistant_id))

        # Generate content
        response = asyncio.run(client.add_message(
            thread_id=thread.thread_id,
            content=full_prompt,
            llm_provider="openai",
            model_name="gpt-4o",
            stream=False
        ))

        generated_content = response.content

        # Save to MongoDB
        if db is not None:
            db.generated_content.insert_one({
                "video_id": video_id,
                "video_title": video_title,
                "content_type": content_type,
                "content": generated_content,
                "topics": topics,
                "timestamp": datetime.utcnow()
            })

        return jsonify({
            "status": "success",
            "video_id": video_id,
            "content_type": content_type,
            "content": generated_content,
            "assistant_id": assistant.assistant_id,
            "thread_id": thread.thread_id
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
            print(f"DEBUG: Received data: {data}") # See what Express sent
            
            video_url = data.get('videoUrl')
            lecture_id = data.get('lectureId')

            if not video_url:
                return jsonify({"error": "No video URL provided"}), 400

            # Trigger the Twelve Labs indexing process
            task_id = start_video_indexing(video_url)
            
            if task_id:
                return jsonify({
                    "success": True, 
                    "message": "Indexing task created", 
                    "task_id": task_id
                }), 202
            else:
                return jsonify({"error": "Failed to start indexing"}), 500
        
        except Exception as e:
            print(f"CRITICAL ROUTE ERROR: {e}") # This will show in your terminal
            return jsonify({"error": str(e)}), 500

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("FLASK_PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
