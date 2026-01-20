# Troubleshooting Guide

## Issue 1: CORS Error When Playing Videos

**Error:** `Access to video at 'https://...r2.cloudflarestorage.com/...' from origin 'https://hi-ready-continued.vercel.app' has been blocked by CORS policy`

**Cause:** The R2 bucket CORS configuration doesn't allow GET requests from your Vercel domain.

**Fix:** Update your R2 bucket CORS configuration in Cloudflare Dashboard:

1. Go to Cloudflare Dashboard → R2 → Your Bucket → Settings → CORS
2. Add this configuration (or update existing):

```json
[
  {
    "AllowedOrigins": [
      "https://hi-ready-continued.vercel.app",
      "https://*.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Range", "Content-Length", "ETag", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

**Important:**
- `GET` method is required for video playback
- `PUT` method is required for video uploads
- Make sure your production domain is in `AllowedOrigins`

---

## Issue 2: Videos Uploaded But No Segments Generated

**Symptom:** Video uploads successfully, but `lectureSegments` array is empty (0 segments).

**Possible Causes:**
1. Flask server is not reachable from Vercel
2. TwelveLabs indexing failed silently
3. Video URL is not accessible to TwelveLabs

**How to Debug:**

1. **Check Vercel Function Logs:**
   - Go to Vercel Dashboard → Your Project → Functions → View Logs
   - Look for upload completion logs when you upload a video
   - You should see:
     - `✅ Flask server is reachable. Starting video indexing...`
     - `✅ Indexing started with task_id: ...`
     - `✅ Successfully received X segments from TwelveLabs.`

2. **Check Flask Environment Variables:**
   - Ensure `FLASK_BASE_URL` is set correctly in Vercel
   - It should point to your Flask deployment (Railway, Render, etc.)
   - Example: `FLASK_BASE_URL=https://your-flask-app.railway.app`

3. **Check Flask Logs:**
   - Check your Flask deployment logs (Railway/Render dashboard)
   - Look for TwelveLabs indexing errors
   - Check if `TWELVELABS_API_KEY` and `TWELVELABS_INDEX_ID` are set correctly

4. **Verify Video URL Accessibility:**
   - The signed download URL must be accessible to TwelveLabs
   - Check if the R2 bucket allows public access or if presigned URLs work correctly

**Fix:**
- If Flask is not reachable: Update `FLASK_BASE_URL` in Vercel environment variables
- If TwelveLabs API fails: Check Flask logs for specific error messages
- If video URL is inaccessible: Verify R2 bucket permissions and presigned URL generation

---

## Issue 3: 404 Error for Segment Rewinds API

**Error:** `GET /api/analytics/lecture/lecture-1/segment-rewinds 404`

**Cause:** The frontend was using a mock lecture ID (`lecture-1`) instead of the real lecture ID from the database.

**Fix Applied:**
- Updated `InstructorDashboard.tsx` to use `lectureId` field if available, otherwise fall back to `id`
- This ensures the correct lecture ID is used for API calls

**If you still see 404 errors:**
1. Check that the lecture exists in the database
2. Verify the lecture ID format matches what's stored in MongoDB
3. Check browser console for the actual lecture ID being used

---

## General Debugging Tips

### Check MongoDB Connection
- Visit `/api/health` endpoint to check database connection status
- Should return: `{"status":"ok","database":{"status":"connected","connected":true}}`

### Check API Endpoints
- All analytics endpoints now ensure MongoDB connection before querying
- If you see connection errors, check Vercel logs for MongoDB connection issues

### Check Video Upload Flow
1. Upload video → Should get presigned URL
2. Upload to R2 → Should succeed
3. Call `/upload/complete` → Should trigger Flask indexing
4. Flask indexes video → Should return segments
5. Segments saved to database → Should appear in frontend

### Common Environment Variables to Check
- `MONGODB_URI` - Must include database name (e.g., `/hiready`)
- `FLASK_BASE_URL` - Must point to your Flask deployment
- `TWELVELABS_API_KEY` - Must be set in Flask environment
- `TWELVELABS_INDEX_ID` - Must be set in Flask environment
- `R2_*` variables - Must be set in Vercel for upload/streaming
