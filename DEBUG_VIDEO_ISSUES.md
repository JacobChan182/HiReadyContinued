# Debugging Video Upload and Playback Issues

## Issue 1: CORS Error When Playing Videos

**Error:** `Access to video at 'https://...r2.cloudflarestorage.com/...' from origin 'https://hi-ready-continued.vercel.app' has been blocked by CORS policy`

**Root Cause:** The VideoPlayer is falling back to direct R2 URLs when presigned URL generation fails.

### How to Debug:

1. **Check Browser Console:**
   - Look for: `"Failed to load stream URL, using videoUrl directly"`
   - This means `/api/upload/stream/:videoKey` is failing

2. **Check Vercel Function Logs:**
   - Go to Vercel Dashboard → Your Project → Functions → View Logs
   - Look for errors from `/api/upload/stream/:videoKey` endpoint
   - Check if the endpoint is being called

3. **Test Presigned URL Endpoint Manually:**
   ```bash
   # Replace VIDEO_KEY with actual video key from your database
   curl https://hi-ready-continued.vercel.app/api/upload/stream/videos-continued%2Fvideos%2F696fd7de98c865637512bfd5%2Flecture-1768937479648-1768937479554.mp4
   ```

### Fixes:

**Option 1: Fix R2 CORS (Temporary)**
- Update R2 CORS to include your domain (see R2_CORS_FIX.md)
- This allows direct R2 URLs to work

**Option 2: Fix Presigned URL Generation (Recommended)**
- Check Vercel logs for errors in `/api/upload/stream/:videoKey`
- Verify R2 environment variables are set correctly
- Ensure the video key format matches what's stored

**Option 3: Improve Error Handling**
- The VideoPlayer should show an error instead of silently falling back
- Add better logging to see why presigned URL generation fails

---

## Issue 2: Videos Have 0 Segments

**Symptom:** Videos upload successfully but `hasSegments: false, segmentCount: 0`

**Root Cause:** TwelveLabs indexing is not completing. This can happen if:
1. Flask server is not reachable
2. FLASK_BASE_URL is not set or incorrect
3. TwelveLabs indexing is failing
4. Segmentation is timing out

### How to Debug:

1. **Check Vercel Function Logs After Upload:**
   Look for these log messages in `/api/upload/complete`:
   ```
   [Node] Checking Flask health at https://...
   ✅ Flask server is reachable. Starting video indexing...
   [Node] Calling /api/index-video for lecture ...
   ✅ Indexing started with task_id: ...
   [Node] Requesting segmentation for ... with task_id: ...
   ✅ Successfully received X segments from TwelveLabs.
   ```

   **If you see:**
   - `❌ Flask server at ... is not reachable` → FLASK_BASE_URL is wrong or Flask is down
   - `❌ Failed to start video indexing. Response was null.` → Flask endpoint is failing
   - `❌ No task_id returned from indexing endpoint` → Flask response format is wrong
   - `❌ Segmentation failed` → TwelveLabs indexing is failing

2. **Check Flask Deployment Logs:**
   - Go to Railway/Render dashboard → Your Flask service → Logs
   - Look for TwelveLabs API errors
   - Check if `TWELVELABS_API_KEY` and `TWELVELABS_INDEX_ID` are set

3. **Test Flask Health Endpoint:**
   ```bash
   curl https://your-flask-app.railway.app/health
   # Should return: {"status":"ok","server":"Flask"}
   ```

4. **Test Flask Indexing Endpoint:**
   ```bash
   curl -X POST https://your-flask-app.railway.app/api/index-video \
     -H "Content-Type: application/json" \
     -d '{"videoUrl": "https://test-video-url.com/video.mp4", "lectureId": "test-lecture"}'
   # Should return: {"status": "success", "task_id": "..."}
   ```

### Fixes:

1. **Set FLASK_BASE_URL in Vercel:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add: `FLASK_BASE_URL=https://your-flask-app.railway.app`
   - Redeploy Vercel

2. **Verify Flask Environment Variables:**
   - In Railway/Render, check that these are set:
     - `TWELVELABS_API_KEY`
     - `TWELVELABS_INDEX_ID`
     - `MONGODB_URI`

3. **Check Flask Logs for Errors:**
   - Look for TwelveLabs API errors
   - Check if video URLs are accessible to TwelveLabs
   - Verify the index ID is correct

4. **Increase Timeout (if needed):**
   - The segmentation endpoint has a 10-minute timeout
   - Very long videos might need more time
   - Check Flask logs to see if it's timing out

---

## Quick Checklist

### For CORS Issues:
- [ ] Check browser console for presigned URL errors
- [ ] Check Vercel logs for `/api/upload/stream/:videoKey` errors
- [ ] Update R2 CORS config (remove wildcards, add exact domain)
- [ ] Test presigned URL endpoint manually
- [ ] Hard refresh browser after CORS changes

### For Segment Issues:
- [ ] Check Vercel logs for Flask connection status
- [ ] Verify FLASK_BASE_URL is set in Vercel
- [ ] Test Flask health endpoint
- [ ] Check Flask logs for TwelveLabs errors
- [ ] Verify Flask environment variables (TWELVELABS_API_KEY, TWELVELABS_INDEX_ID)
- [ ] Check if video URLs are accessible to TwelveLabs

---

## Expected Log Flow for Successful Upload

When a video uploads successfully with segments, you should see:

**In Vercel Logs (`/api/upload/complete`):**
```
[Node] Checking Flask health at https://your-flask.railway.app...
✅ Flask server is reachable. Starting video indexing...
[Node] Calling /api/index-video for lecture lecture-123...
[Node] Indexing response - status: success, task_id: task_abc123
✅ Indexing started with task_id: task_abc123
[Node] Requesting segmentation for lecture-123 with task_id: task_abc123...
--- DATA VALIDATION ---
Lecture ID: lecture-123
Video ID: video_xyz789
Segments Length: 5
✅ Successfully received 5 segments from TwelveLabs.
```

**In Flask Logs:**
```
[TwelveLabs] Polling task_id=task_abc123 every 2s up to 900s
[TwelveLabs] Task task_abc123: status=ready video_id=video_xyz789
[TwelveLabs] Task task_abc123 completed. video_id=video_xyz789
[TwelveLabs] Waiting 30s for Pegasus engine to finalize...
DEBUG: Starting segmentation for video_id: video_xyz789
```

If you don't see these logs, that's where the issue is.
