from twelvelabs import TwelveLabs
import os
from dotenv import load_dotenv

load_dotenv()

# Now this will correctly find your key
api_key = os.getenv("TWELVELABS_API_KEY")

if not api_key:
    raise ValueError("TWELVELABS_API_KEY not found! Check your .env file.")

client = TwelveLabs(api_key=api_key)

def start_video_indexing(video_url):
    """
    Sends the public R2 URL to Twelve Labs to begin indexing.
    """
    try:
        # 1. Create the indexing task
        task = client.tasks.create(
            index_id=os.getenv("TWELVELABS_INDEX_ID"),
            video_url=video_url
        )
        print(f"Indexing started. Task ID: {task.id}")
        
        # 2. Return the task ID so you can track it later
        return task.id
    except Exception as e:
        print(f"Error starting Twelve Labs task: {e}")
        return None