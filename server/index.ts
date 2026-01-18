import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; 

// These two lines recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root BEFORE importing other modules
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });
console.log('Bucket Name:', process.env.R2_BUCKET_NAME);

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url'; // This is what was missing


import connectDB from './db';
import analyticsRoutes from './routes/analytics';
import authRoutes from './routes/auth';
import loginsRoutes from './routes/logins';
import coursesRoutes from './routes/courses';
import studentsRoutes from './routes/students';
import uploadRoutes from './routes/upload';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
