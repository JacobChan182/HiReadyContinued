# Where to Set FLASK_BASE_URL

## Quick Answer

**`FLASK_BASE_URL` should be set in Vercel environment variables.**

It's used by your Express backend (which runs on Vercel) to communicate with your Flask backend (which runs on Railway/Render).

---

## Detailed Explanation

### Where It's Used

`FLASK_BASE_URL` is used in:
- `lib/routes/upload.ts` - When videos are uploaded, Express calls Flask to index them
- `server/routes/upload.ts` - Same functionality, different file location

The code looks like this:
```typescript
const FLASK_BASE_URL =
  process.env.FLASK_BASE_URL ||
  process.env.DOCKER_FLASK_SERVICE ||
  'http://127.0.0.1:5001'; // Fallback for local development
```

### Where to Set It

#### ✅ **Vercel Environment Variables** (Production)

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Click **Add New**
3. Set:
   - **Key:** `FLASK_BASE_URL`
   - **Value:** Your Flask deployment URL (e.g., `https://your-app-name.up.railway.app`)
   - **Environment:** Select all (Production, Preview, Development)

4. **Redeploy** your Vercel project for the change to take effect

#### ✅ **Local Development** (Optional)

If you're running Flask locally for development, you can set it in:
- `server/.env` file:
  ```
  FLASK_BASE_URL=http://127.0.0.1:5001
  ```

Or it will automatically use `http://127.0.0.1:5001` as the fallback.

---

## What Value Should It Be?

### If Flask is on Railway:
```
FLASK_BASE_URL=https://your-app-name.up.railway.app
```

### If Flask is on Render:
```
FLASK_BASE_URL=https://your-app-name.onrender.com
```

### If Flask is on another service:
```
FLASK_BASE_URL=https://your-flask-domain.com
```

**Important:** 
- ✅ Use `https://` (not `http://`)
- ✅ Don't include trailing slash
- ✅ Don't include `/api` or other paths - just the base URL

---

## How to Verify It's Set Correctly

### 1. Check Vercel Logs

After uploading a video, check Vercel function logs. You should see:
```
[Node] Using Flask base URL: https://your-app-name.up.railway.app
[Node] Checking Flask health at https://your-app-name.up.railway.app...
✅ Flask server is reachable. Starting video indexing...
```

If you see:
```
❌ Flask server at https://... is not reachable
```

Then `FLASK_BASE_URL` is either:
- Not set
- Set incorrectly
- Flask server is down

### 2. Test Flask Health Endpoint

You can test if your Flask URL is correct:
```bash
curl https://your-app-name.up.railway.app/health
# Should return: {"status":"ok","server":"Flask"}
```

---

## Common Issues

### Issue: "Flask server is not reachable"

**Causes:**
1. `FLASK_BASE_URL` not set in Vercel
2. Wrong URL (typo, wrong domain)
3. Flask server is down
4. Network/firewall blocking the connection

**Fix:**
1. Verify `FLASK_BASE_URL` is set in Vercel environment variables
2. Test the Flask URL directly: `curl https://your-flask-url.com/health`
3. Check Flask deployment logs (Railway/Render dashboard)
4. Redeploy Vercel after setting the variable

### Issue: Videos upload but no segments generated

**Cause:** Flask is not reachable, so TwelveLabs indexing never happens

**Fix:** Set `FLASK_BASE_URL` correctly in Vercel

---

## Summary

| Where | What | Why |
|-------|------|-----|
| **Vercel** | `FLASK_BASE_URL` | Express (on Vercel) needs to know where Flask is |
| **Railway/Render** | Flask deployment URL | This is what you copy into `FLASK_BASE_URL` |
| **Local dev** | `http://127.0.0.1:5001` | Optional, auto-fallback if not set |

**Remember:** 
- Express runs on Vercel → needs `FLASK_BASE_URL` to call Flask
- Flask runs on Railway/Render → provides the URL for `FLASK_BASE_URL`
- Set it once in Vercel, redeploy, and you're done!
