import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root BEFORE importing other modules
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

import connectDB from './db';
import analyticsRoutes from './routes/analytics';
import authRoutes from './routes/auth';
import loginsRoutes from './routes/logins';
import lecturersRoutes from './routes/lecturers';
import studentsRoutes from './routes/students';
import uploadRoutes from './routes/upload';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));

// Connect to MongoDB
connectDB().catch(console.error);

// Routes
app.use('/api/analytics', analyticsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/logins', loginsRoutes);
app.use('/api/lecturers', lecturersRoutes);
app.use('/api/students', studentsRoutes);
// Apply raw body parser only to direct upload endpoint
app.use('/api/upload/direct', express.raw({ type: 'video/*', limit: '500mb' }));
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
