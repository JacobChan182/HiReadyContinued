// Vercel serverless function handler for Express app
// This file handles all /api/* routes

// Import all dependencies directly (Vercel compiles TypeScript in api/ directory)
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file if it exists (for local dev)
// On Vercel, environment variables are provided via process.env automatically
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  try {
    const envPath = path.resolve(__dirname, '../../.env');
    dotenv.config({ path: envPath });
  } catch (error) {
    console.debug('No .env file found, using environment variables from Vercel');
  }
}

// Import routes and database connection from lib/ (outside api/ to avoid function limits)
import connectDB from '../lib/db.js';
import analyticsRoutes from '../lib/routes/analytics.js';
import authRoutes from '../lib/routes/auth.js';
import loginsRoutes from '../lib/routes/logins.js';
import coursesRoutes from '../lib/routes/courses.js';
import studentsRoutes from '../lib/routes/students.js';
import uploadRoutes from '../lib/routes/upload.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Get allowed origins from environment or defaults
const frontendUrl = process.env.FRONTEND_URL || (process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:5173');

const allowedOrigins = new Set([
  frontendUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  // Allow Vercel production domain
  'https://hi-ready.vercel.app',
  // Allow custom domain
  'https://hiready.tech',
  'https://www.hiready.tech',
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check exact matches
    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    
    // Check if origin matches *.vercel.app pattern
    if (process.env.VERCEL && /^https:\/\/.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    
    // Check if origin is the production domain (Vercel or custom)
    if (origin === 'https://hi-ready.vercel.app' || 
        origin === 'https://hiready.tech' || 
        origin === 'https://www.hiready.tech') {
      return callback(null, true);
    }
    
    console.warn(`CORS blocked for origin: ${origin}`);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '500mb' }));

// Initialize MongoDB connection with better error handling
connectDB().catch((error) => {
  console.error('❌ Failed to connect to MongoDB:', error);
  console.error('Error details:', {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : 'Unknown',
    code: (error as any)?.code,
  });
  // Log connection string (without password) for debugging
  const uri = process.env.MONGODB_URI || 'not set';
  const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
  console.error('Connection string:', maskedUri);
});

// Routes
app.use('/api/analytics', analyticsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/logins', loginsRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/students', studentsRoutes);
// Apply raw body parser only to direct upload endpoint
app.use('/api/upload/direct', express.raw({ type: 'video/*', limit: '500mb' }));
app.use('/api/upload', uploadRoutes);

// health check endpoint (available at /api/health)
app.get('/api/health', async (req, res) => {
  try {
    const mongoose = await import('mongoose');
    const dbStatus = mongoose.default.connection.readyState;
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    const health = {
      status: 'ok',
      server: 'Express',
      database: {
        status: dbStates[dbStatus] || 'unknown',
        connected: dbStatus === 1
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      server: 'Express',
      database: { status: 'error', connected: false },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test root /api route
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'API is running', path: req.path, url: req.url });
});

// Also allow /health for convenience
app.get('/health', async (req, res) => {
  try {
    const mongoose = await import('mongoose');
    const dbStatus = mongoose.default.connection.readyState;
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    const health = {
      status: 'ok',
      server: 'Express',
      database: {
        status: dbStates[dbStatus] || 'unknown',
        connected: dbStatus === 1
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      server: 'Express',
      database: { status: 'error', connected: false },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export app for Vercel serverless functions
export default app;

// Only listen in local development (Vercel handles this in production)
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}
