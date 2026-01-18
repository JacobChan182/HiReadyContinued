# Deploying Frontend to Vercel

This guide will help you deploy the frontend of NoMoreTears to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. Your backend API server deployed and accessible (Express server on port 3001)
3. Your Flask API server deployed and accessible (Flask server on port 5001)

## Step 1: Install Vercel CLI (Optional)

You can deploy via the Vercel dashboard or CLI. For CLI:

```bash
npm install -g vercel
```

## Step 2: Deploy via Vercel Dashboard

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/new
   - Import your Git repository (GitHub, GitLab, or Bitbucket)

2. **Configure Project Settings**
   - **Framework Preset**: Vite
   - **Root Directory**: Leave as root (`.`)
   - **Build Command**: `npm run build:frontend`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `npm install`

3. **Set Environment Variables**
   In the Vercel project settings, add these environment variables:
   
   ```
   VITE_API_URL=https://your-backend-domain.com/api
   ```
   
   Replace `https://your-backend-domain.com/api` with your actual production backend URL.
   
   **Important**: 
   - If your Express server is at `https://api.yourdomain.com`, set `VITE_API_URL=https://api.yourdomain.com/api`
   - If your Express server is at `https://yourdomain.com:3001`, set `VITE_API_URL=https://yourdomain.com:3001/api`
   - Make sure your backend server has CORS configured to allow requests from your Vercel domain

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your frontend

## Step 3: Deploy via CLI

Alternatively, you can deploy using the Vercel CLI:

```bash
# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No (first time) or Yes (subsequent)
# - Project name? (your project name)
# - Directory? ./
# - Override settings? No (use vercel.json)
```

For production deployment:

```bash
vercel --prod
```

## Step 4: Configure Backend CORS

Make sure your Express server (`server/index.ts`) allows requests from your Vercel domain:

```typescript
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://your-vercel-app.vercel.app', // Add your Vercel domain
  'https://your-custom-domain.com',     // Add your custom domain if applicable
]);
```

## Step 5: Update Environment Variables After Deployment

After your first deployment, you can update environment variables:

1. Go to your project on Vercel dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add or update `VITE_API_URL` with your production backend URL
4. Redeploy to apply changes

## Important Notes

### API Endpoints

Your frontend makes requests to:
- `/api/js/*` → Express/Node.js server (port 3001)
- `/api/py/*` → Flask/Python server (port 5001)

In production, these need to be configured via `VITE_API_URL` or you'll need to set up Vercel rewrites/proxies.

### Current API Configuration

The frontend uses `VITE_API_URL` environment variable. If not set, it defaults to:
- Development: `/api/js/api` (uses Vite proxy)
- Production: `https://your-backend-domain.com/api` (you must set `VITE_API_URL`)

### CORS Configuration

Your backend servers must allow CORS from your Vercel domain. Update:
- `server/index.ts` - Express server CORS settings
- `backend/app.py` - Flask server CORS settings

### Custom Domain

To use a custom domain:
1. Go to Vercel project settings
2. Navigate to **Domains**
3. Add your custom domain
4. Update DNS records as instructed
5. Update `VITE_API_URL` if needed

## Troubleshooting

### Build Fails

- Check that `npm install` completes successfully
- Verify `build:frontend` script exists in `package.json`
- Check Vercel build logs for specific errors

### API Requests Fail

- Verify `VITE_API_URL` is set correctly in Vercel environment variables
- Check backend CORS configuration allows your Vercel domain
- Verify backend servers are accessible from the internet
- Check browser console for CORS errors

### 404 Errors on Routes

- Verify `vercel.json` has the SPA rewrite rule (already configured)
- Check that `outputDirectory` is set to `frontend/dist`

## Next Steps

After deploying the frontend:
1. Deploy your Express server (Node.js backend) to a hosting service
2. Deploy your Flask server (Python backend) to a hosting service
3. Update `VITE_API_URL` in Vercel to point to your production backend
4. Test all functionality end-to-end
