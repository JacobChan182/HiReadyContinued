from flask import Flask, jsonify, request
from flask_cors import CORS
from twelvelabs import TwelveLabs
import os
from dotenv import load_dotenv
from services.video_service import start_video_indexing

load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app)

    # Initialize Twelve Labs client
    TL_API_KEY = os.getenv("TL_API_KEY")
    if not TL_API_KEY:
        raise RuntimeError("Missing TWELVE_LABS_API_KEY env var")
    tl = TwelveLabs(api_key=TL_API_KEY)

    @app.get("/health")
    def health():
        return {"status": "ok", "server": "Flask"}, 200
    
    @app.route('/api/hello', methods=['GET'])  # match Vite proxy prefix
    def test():
        return {"status": "success"}
    
    @app.route('/api/test-connection', methods=['GET'])
    def test_connection():
        try:
            # A simple call to list indexes to verify the API key works
            indexes = list(tl.indexes.list())
            return {"status": "connected", "index_count": len(indexes)}, 200
        except Exception as e:
            return {"status": "error", "message": str(e)}, 500
        
    @app.route('/api/index-video', methods=['POST'])
    def handle_index_request():
        data = request.json
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

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
