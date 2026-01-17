# Local Video Streaming Testing Guide

Yes, you can test video streaming locally! Follow these steps:

## Prerequisites

1. **Cloudflare R2 Configuration**
   - You need a Cloudflare R2 bucket set up
   - Get your R2 credentials from the Cloudflare dashboard

2. **Environment Variables**
   Ensure your `server/.env` file has all required R2 variables:

   ```env
   # Cloudflare R2 Configuration
   R2_ACCOUNT_ID=your_account_id
   R2_ACCESS_KEY_ID=your_access_key_id
   R2_SECRET_ACCESS_KEY=your_secret_access_key
   R2_BUCKET_NAME=your_bucket_name
   R2_PUBLIC_URL=https://pub-xxxxx.r2.dev  # Optional, if you have a public URL

   # MongoDB (required)
   MONGODB_URI=mongodb+srv://...
   
   # Server
   PORT=3001
   
   # API URL (for frontend)
   VITE_API_URL=http://localhost:3001/api
   ```

3. **R2 Bucket CORS Configuration**
   For local testing, configure CORS on your R2 bucket to allow requests from `http://localhost:5173` (or your Vite dev port).

   In Cloudflare Dashboard → R2 → Your Bucket → Settings → CORS:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:5173", "http://localhost:3000"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["Content-Range", "Content-Length", "ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## Testing Steps

### 1. Start the Development Servers

```bash
# Start all services (frontend, server, flask)
npm run dev

# Or start just frontend and server (without flask)
npm run dev:all

# Or start them individually:
npm run dev:frontend   # Runs on http://localhost:5173
npm run dev:server     # Runs on http://localhost:3001
npm run dev:flask      # Runs on http://localhost:5001 (for Twelve Labs indexing)
```

### 2. Log In as Instructor

1. Open `http://localhost:5173` in your browser
2. Sign up or log in as an instructor/trainer
3. Create a course if you haven't already

### 3. Upload a Test Video

1. In the Instructor Dashboard, click "Upload Video"
2. Select a video file (MP4, WebM, MOV, AVI - keep it under 500MB)
3. Enter a lecture title
4. Select the course
5. Click "Upload"

**Watch for:**
- Upload progress indicator
- Success message after upload completes
- The video should appear in your course lectures

### 4. Test Video Streaming (Student View)

1. Log out and log in as a student/employee (or open in incognito)
2. Navigate to the student dashboard
3. Select the course with the uploaded video
4. Click on the lecture

**What to Test:**
- ✅ Video should load (you'll see a loading spinner briefly)
- ✅ Video should start playing when you click play
- ✅ You should be able to scrub/seek through the video
- ✅ Video should buffer properly (watch network tab)
- ✅ Video controls should work (play, pause, seek)

### 5. Check Browser Developer Tools

Open Browser DevTools (F12) → Network tab:

1. **When video loads:**
   - Look for request to `/api/upload/stream/:videoKey`
   - Should return a presigned URL (200 status)
   - The presigned URL should be used in the video `src`

2. **When playing video:**
   - Look for HTTP 206 (Partial Content) responses
   - This indicates range requests are working (required for streaming)
   - Multiple 206 requests = video is streaming properly

3. **Console tab:**
   - Check for any errors related to video loading
   - Look for warnings about CORS or video format

## Troubleshooting

### Video Doesn't Load

1. **Check R2 Configuration:**
   ```bash
   # Verify server/.env has all R2 variables
   cat server/.env | grep R2
   ```

2. **Check Server Logs:**
   - Look for R2 configuration warnings when server starts
   - Check for errors when generating presigned URLs

3. **Check Video Key Extraction:**
   - Open browser console
   - Should see video URL in network requests
   - Check if video key is extracted correctly

### CORS Errors

If you see CORS errors in the console:
- Ensure R2 bucket CORS is configured (see Prerequisites)
- Make sure `http://localhost:5173` is in allowed origins
- Try hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

### Video URL Issues

1. **Check if `videoUrl` in database:**
   - Should be in format: `${PUBLIC_URL}/videos/...` or direct R2 URL
   - Video key should contain `videos/` path

2. **Check Stream URL Endpoint:**
   - Test manually: `GET http://localhost:3001/api/upload/stream/videos/userId/lectureId-timestamp.mp4`
   - Should return JSON with `streamUrl`

### Video Plays But Doesn't Stream (Buffers Entirely)

- Check if presigned URL includes range request support
- Verify R2 bucket allows range requests (should by default)
- Check network tab for HTTP 206 responses (not 200)

### Fallback Behavior

If streaming fails, the app falls back to using the original `videoUrl` directly. This might work if:
- R2 public URL is configured
- CORS is properly set up
- But it might not support range requests as well

## Manual Testing

You can also test the stream endpoint directly:

```bash
# Replace with actual video key from your database
curl "http://localhost:3001/api/upload/stream/videos/user123/lecture-1234567890.mp4"

# Should return:
# {
#   "success": true,
#   "streamUrl": "https://...presigned-url...",
#   "expiresIn": 3600
# }
```

## Expected Behavior

✅ **Working correctly:**
- Video loads within 1-2 seconds
- Play button appears immediately
- Video plays smoothly
- Seeking/scrubbing works instantly
- Network tab shows multiple HTTP 206 requests (streaming)

❌ **Not working:**
- Video never loads (spinner keeps spinning)
- CORS errors in console
- Video loads but doesn't play
- Seeking doesn't work (video jumps back)
- Network tab shows single HTTP 200 (not streaming)

## Notes

- Presigned URLs expire after 1 hour (3600 seconds)
- If a URL expires, refresh the page to get a new one
- Large videos (>100MB) might take a moment to start streaming
- The video element uses `preload="metadata"` for efficiency
- Streaming works best with MP4 format (most compatible)
