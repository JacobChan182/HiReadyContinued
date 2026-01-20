# Fixing R2 CORS Error

## Problem

Even though `https://hi-ready-continued.vercel.app` is in your CORS config, you're still getting CORS errors. This is likely because:

1. **R2 CORS doesn't support wildcards** - The `https://*.vercel.app` pattern doesn't work
2. **CORS config needs to be saved/applied** - Changes might not have propagated
3. **Browser cache** - Old CORS headers might be cached

## Solution

### Step 1: Update R2 CORS Configuration

Go to **Cloudflare Dashboard** → **R2** → **Your Bucket** → **Settings** → **CORS**

**Remove the wildcard** and use this exact configuration:

```json
[
  {
    "AllowedOrigins": [
      "https://hiready.tech",
      "https://www.hiready.tech",
      "https://hi-ready.vercel.app",
      "https://hi-ready-continued.vercel.app",
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

**Important changes:**
- ❌ **Removed:** `"https://*.vercel.app"` (wildcards don't work in R2 CORS)
- ✅ **Keep:** `"https://hi-ready-continued.vercel.app"` (explicit domain)
- ✅ **Keep:** `"GET"` method (required for video playback)

### Step 2: Save the Configuration

1. **Click "Save"** in the Cloudflare dashboard
2. **Wait 1-2 minutes** for the CORS config to propagate

### Step 3: Clear Browser Cache

1. **Hard refresh** your browser:
   - Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Firefox: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
2. Or **clear browser cache** completely
3. Or **test in incognito/private mode**

### Step 4: Test Again

1. Upload a new video or try playing an existing one
2. Check browser console - CORS error should be gone
3. If still getting errors, wait another 2-3 minutes and try again

## Why Wildcards Don't Work

Cloudflare R2 CORS follows AWS S3 CORS specification, which **does not support wildcard patterns** in `AllowedOrigins`. You must list each domain explicitly.

## For Preview Deployments

If you need to support Vercel preview deployments (which have random subdomains), you have two options:

### Option 1: Add Common Preview Domains (Manual)

Add the most common preview domains you use:
```json
"AllowedOrigins": [
  "https://hi-ready-continued.vercel.app",
  "https://hi-ready-continued-git-main.vercel.app",
  "https://hi-ready-continued-git-*.vercel.app",  // Still won't work - wildcards don't work
  // ... add more as needed
]
```

**Note:** This is not practical since preview URLs are random.

### Option 2: Use Presigned URLs with CORS Headers (Recommended)

Instead of allowing all preview domains in R2 CORS, you can:
1. Generate presigned URLs from your Express backend
2. The backend can add CORS headers when generating the URL
3. This way, only your backend needs to be in R2 CORS, not every preview domain

This is already how your upload flow works, but for video playback, you might need to use presigned URLs instead of direct R2 URLs.

## Verification

After updating CORS:

1. **Check the CORS config is saved:**
   - Go back to R2 → Settings → CORS
   - Verify your changes are there

2. **Test with curl:**
   ```bash
   curl -H "Origin: https://hi-ready-continued.vercel.app" \
        -H "Access-Control-Request-Method: GET" \
        -X OPTIONS \
        https://your-bucket.r2.cloudflarestorage.com/your-video.mp4 \
        -v
   ```
   
   You should see `Access-Control-Allow-Origin: https://hi-ready-continued.vercel.app` in the response headers.

3. **Check browser console:**
   - No CORS errors
   - Video plays successfully

## Still Not Working?

If you've done all the above and still get CORS errors:

1. **Double-check the exact domain:**
   - Make sure there are no typos
   - Check if it's `https://` not `http://`
   - Verify no trailing slashes

2. **Check R2 bucket permissions:**
   - Make sure the bucket allows public read access (for GET requests)
   - Or ensure presigned URLs are being used correctly

3. **Check Vercel deployment:**
   - Verify the domain matches exactly what's in CORS
   - Check if there are any redirects happening

4. **Wait longer:**
   - CORS changes can take up to 5 minutes to propagate globally
