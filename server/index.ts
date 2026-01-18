import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; 

// These two lines recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file if it exists (for local dev)
// On Vercel, environment variables are provided via process.env automatically
// Try to load .env from project root, but don't fail if it doesn't exist
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  try {
    const rootEnv = path.resolve(__dirname, '../.env');
    const serverEnv = path.resolve(__dirname, './.env');

    dotenv.config({ path: rootEnv }); // Try root first
    dotenv.config({ path: serverEnv }); // Then try server/ folder
  } catch (error) {
    // .env file doesn't exist, which is fine - Vercel uses environment variables
    console.debug('No .env file found, using environment variables from Vercel');
  }
}

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import connectDB from './db';
import analyticsRoutes from './routes/analytics';
import authRoutes from './routes/auth';
import loginsRoutes from './routes/logins';
import coursesRoutes from './routes/courses';
import studentsRoutes from './routes/students';
import uploadRoutes from './routes/upload';

const app = express();
const PORT = process.env.PORT || 3001;

// Get allowed origins from environment or defaults
const frontendUrl = process.env.FRONTEND_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:5173';

const allowedOrigins = new Set([
  frontendUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  // Allow Vercel preview deployments
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '500mb' }));

connectDB().catch(console.error);

// Routes
app.use('/api/analytics', analyticsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/logins', loginsRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/students', studentsRoutes);
// Apply raw body parser only to direct upload endpoint
app.use('/api/upload/direct', express.raw({ type: 'video/*', limit: '500mb' }));
app.use('/api/upload', uploadRoutes);

// health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'Express' });
});

// Export app for Vercel serverless functions
export default app;

// Only listen in local development (Vercel handles this in production)
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}
