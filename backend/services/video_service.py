import traceback
import os
import time
from pathlib import Path
from dotenv import load_dotenv
from twelvelabs import TwelveLabs
import json
import re

# 1. Setup and Load
BASE_DIR = Path(__file__).resolve().parent.parent
dotenv_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=dotenv_path)

# 2. Get variables once at startup
API_KEY = os.getenv("TWELVELABS_API_KEY")
INDEX_ID = os.getenv("TWELVELABS_INDEX_ID")

client = TwelveLabs(api_key=API_KEY)

def start_video_indexing(video_url):
    try:
        print(f"DEBUG: Starting task for Index ID: {INDEX_ID}")
        task = client.tasks.create(
            index_id=INDEX_ID,
            video_url=video_url
        )
        print(f"✅ Indexing started. Task ID: {task.id}")
        return task.id
    except Exception as e:
        traceback.print_exc()
        return None

def wait_for_task_completion(task_id, timeout_sec=900, poll_interval_sec=2):
    """
    Poll the TwelveLabs task until it completes or times out.
    Returns the video_id (indexed video id) if completed, else None.
    """
    start = time.time()
    try:
        print(f"[TwelveLabs] Polling task_id={task_id} every {poll_interval_sec}s up to {timeout_sec}s")
        while time.time() - start < timeout_sec:
            task = client.tasks.retrieve(task_id)
            status = getattr(task, "status", None)
            video_id = getattr(task, "video_id", None)
            
            print(f"[TwelveLabs] Task {task_id}: status={status} video_id={video_id}")
            
            if status == "ready" and video_id:
                print(f"[TwelveLabs] Task {task_id} completed. video_id={video_id}")
                return video_id
            if status in ("failed", "error"):
                print(f"[TwelveLabs] Task {task_id} failed.")
                return None
            
            time.sleep(poll_interval_sec)
        
        print(f"[TwelveLabs] Task {task_id} timed out after {timeout_sec}s.")
        return None
    except Exception:
        traceback.print_exc()
        return None

def _log_segments(segments, prefix="Segments"):
    try:
        print(f"{prefix}: total={len(segments)}")
        for i, s in enumerate(segments[:5]):
            print(f"{prefix}[{i}] {s.get('start')} - {s.get('end')} :: {s.get('title')} :: {(s.get('summary') or '')[:120]}")
        if len(segments) > 5:
            print(f"{prefix}: ...and {len(segments) - 5} more")
    except Exception:
        traceback.print_exc()

def segment_video_topics(video_id):
    print(f"[TwelveLabs] Waiting 30s for Pegasus engine to finalize...")
    time.sleep(30) 

    try:
        print(f"DEBUG: Starting segmentation for video_id: {video_id}")
        
        prompt = (
            "Analyze this video and split it into a list of main topics. Include the topic name, a summary/details of each topic, "
            "as well as the start and end time of the video where this topic is covered in seconds. "
            "Return the response strictly as a JSON object with this structure. The variable count will always be set to 0.: "
            '{"segments": [{"count": 0, "start": 0, "end": 60, "title": "Topic Name", "summary": "..."}]}'
        )

        result = client.analyze(video_id=video_id, prompt=prompt)
        raw_text = getattr(result, 'data', None)
        
        if not raw_text:
            return {"segments": []}

        # Extract and parse JSON
        json_match = re.search(r'(\{.*\})', raw_text, re.DOTALL)
        if json_match:
            try:
                # This is your single source of truth
                data = json.loads(json_match.group(1))
                return data 
            except json.JSONDecodeError:
                print("❌ JSON Parse Error")
        
        return {"segments": []}

    except Exception as e:
        print(f"❌ API Error: {e}")
        return {"segments": []}
    
def index_and_segment(video_url):
    task_id = start_video_indexing(video_url)
    if not task_id: return {"segments": []}
    
    video_id = wait_for_task_completion(task_id)
    if not video_id: return {"segments": []}
    
    # Returns the full dict: {"segments": [...]}
    return segment_video_topics(video_id)

def verify_index_configuration():
    try:
        index = client.indexes.retrieve(INDEX_ID)
        # In the newest SDK, it is .models
        model_names = [m.model_name for m in index.models]
        print(f"[TwelveLabs] Index {INDEX_ID} has models: {model_names}")
        
        if not any('pegasus' in name for name in model_names):
            print("⚠️ WARNING: Pegasus model missing!")
            return False
        return True
    except Exception as e:
        print(f"[TwelveLabs] Verification error: {e}")
        return False