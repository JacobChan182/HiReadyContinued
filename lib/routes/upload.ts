import express, { Request, Response } from 'express';
// @ts-expect-error - AWS SDK types are not resolving correctly in TypeScript, but work at runtime
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// @ts-expect-error - AWS SDK types are not resolving correctly in TypeScript, but work at runtime
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';
import { s3Client, BUCKET_NAME, generateVideoKey, getVideoUrl } from '../utils/r2.js';
import { Lecturer } from '../models/Lecturer.js';
import { Course } from '../models/Course.js';

const router = express.Router();

// Resolve Flask base URL with fallbacks
const FLASK_BASE_URL =
  process.env.FLASK_BASE_URL ||
  process.env.DOCKER_FLASK_SERVICE || // e.g., http://flask:5001 from docker-compose
  'http://127.0.0.1:5001';

console.log(`[Node] Using Flask base URL: ${FLASK_BASE_URL}`);

// Use a base axios instance for general calls...
const flask = axios.create({ baseURL: FLASK_BASE_URL, timeout: 15000 });

async function tryFlask<T>(fn: () => Promise<T>, label: string, retries = 2, delayMs = 1000): Promise<T | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.response?.data || err?.message || err;
      console.error(`${label} attempt ${i + 1} failed:`, msg);
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        console.error(`Cannot reach Flask at ${FLASK_BASE_URL}. Check FLASK_BASE_URL and that Flask is running.`);
      }
      if (i < retries) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return null;
}

// Helper function to update lecture with segments (called asynchronously after segmentation completes)
async function updateLectureWithSegments(
  lectureId: string,
  courseId: string,
  segments: any[],
  fullAiData: any,
  videoId: string | null
) {
  try {
    // Ensure MongoDB is connected
    const mongoose = await import('mongoose');
    const CONNECTED_STATE = 1;
    if (mongoose.default.connection.readyState !== CONNECTED_STATE) {
      const connectDB = (await import('../db.js')).default;
      await connectDB();
      if (mongoose.default.connection.readyState !== CONNECTED_STATE) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const { Course } = await import('../models/Course.js');
    const { Lecturer } = await import('../models/Lecturer.js');

    // Transform segments
    const lectureSegments = segments.map((seg: any) => ({
      start: seg.start || seg.startTime || 0,
      end: seg.end || seg.endTime || 0,
      title: seg.title || seg.name || 'Untitled Segment',
      summary: seg.summary || ''
    }));

    // Update Course
    const course = await Course.findOne({ courseId });
    if (course) {
      const lectureIndex = course.lectures.findIndex(l => l.lectureId === lectureId);
      if (lectureIndex > -1) {
        course.lectures[lectureIndex].lectureSegments = lectureSegments;
        course.lectures[lectureIndex].rawAiMetaData = fullAiData || {};
        course.markModified('lectures');
        await course.save();
        console.log(`✅ Updated course lecture ${lectureId} with ${segments.length} segments`);
      }
    }

    // Update Lecturer (find by lectureId in any lecturer's lectures)
    const lecturers = await Lecturer.find({ 'lectures.lectureId': lectureId });
    for (const lecturer of lecturers) {
      const lectureIndex = lecturer.lectures.findIndex(l => l.lectureId === lectureId);
      if (lectureIndex > -1) {
        lecturer.lectures[lectureIndex].lectureSegments = lectureSegments;
        lecturer.lectures[lectureIndex].rawAiMetaData = fullAiData || {};
        lecturer.markModified('lectures');
        await lecturer.save();
        console.log(`✅ Updated lecturer lecture ${lectureId} with ${segments.length} segments`);
      }
    }
  } catch (error) {
    console.error('[Node] Error updating lecture with segments:', error);
  }
}

// 1. Generate presigned URL for video upload
router.post('/presigned-url', async (req: Request, res: Response) => {
  try {
    const { userId, lectureId, filename, contentType } = req.body;

    if (!userId || !lectureId || !filename) {
      return res.status(400).json({ error: 'Missing required fields: userId, lectureId, filename' });
    }

    if (!BUCKET_NAME) {
      console.error('R2_BUCKET_NAME is not configured');
      return res.status(500).json({ error: 'R2 bucket configuration missing.' });
    }

    const validExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension || !validExtensions.includes(extension)) {
      return res.status(400).json({ error: 'Invalid file type. Only video files are allowed.' });
    }

    const key = generateVideoKey(userId, lectureId, filename);

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || `video/${extension}`,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.status(200).json({
      success: true,
      presignedUrl,
      key,
      publicUrl: getVideoUrl(key),
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// 2. Complete upload - Update Lecturer, Course, and Trigger Indexing
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { userId, lectureId, videoKey, lectureTitle, courseId } = req.body;

    if (!userId || !lectureId || !videoKey || !courseId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Ensure MongoDB is connected - try to connect if not connected
    const mongoose = await import('mongoose');
    const CONNECTED_STATE = 1; // mongoose.connection.readyState === 1 means connected
    if (mongoose.default.connection.readyState !== CONNECTED_STATE) {
      console.log('⚠️  MongoDB not connected. Ready state:', mongoose.default.connection.readyState, '- Attempting to connect...');
      try {
        const connectDB = (await import('../db.js')).default;
        await connectDB();
        // Wait a moment for connection to establish
        if (mongoose.default.connection.readyState !== CONNECTED_STATE) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        return res.status(500).json({ 
          error: 'Database connection failed. Please check your MongoDB configuration.',
          details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
        });
      }
      
      if (mongoose.default.connection.readyState !== CONNECTED_STATE) {
        console.error('❌ MongoDB still not connected after retry. Ready state:', mongoose.default.connection.readyState);
        return res.status(500).json({ error: 'Database connection not established. Please try again.' });
      }
    }

    // A. Verify Course and Permissions
    const course = await Course.findOne({ courseId });
    if (!course) return res.status(404).json({ error: `Course ${courseId} not found.` });
    if (course.instructorId !== userId) return res.status(403).json({ error: 'Permission denied' });

    // B. Generate signed URL for Twelve Labs
    const downloadCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: videoKey });
    const signedDownloadUrl = await getSignedUrl(s3Client, downloadCommand, { expiresIn: 3600 });

    let segments: any[] = [];
    let fullAiData: any = null;
    let videoIdFromTask: string | null = null;
    let taskIdFromTask: string | null = null;

    // C. Flask Integration (Single Flow)
    console.log(`[Node] Checking Flask health at ${FLASK_BASE_URL}...`);
    const health = await tryFlask(() => flask.get('/health'), 'Flask health check');
    if (!health) {
      console.error(`❌ Flask server at ${FLASK_BASE_URL} is not reachable. Video will be uploaded but not analyzed by TwelveLabs.`);
    } else {
      console.log(`✅ Flask server is reachable. Starting video indexing...`);
      
      // 1. Start Indexing
      console.log(`[Node] Calling /api/index-video for lecture ${lectureId}...`);
      const indexResp = await tryFlask(
        () => flask.post('/api/index-video', { videoUrl: signedDownloadUrl, lectureId }),
        'Indexing trigger'
      );
      
      if (!indexResp) {
        console.error('❌ Failed to start video indexing. Response was null.');
      } else {
        // The /api/index-video endpoint returns task_id, not video_id
        taskIdFromTask = (indexResp as any)?.data?.task_id || (indexResp as any)?.task_id || null;
        const indexStatus = (indexResp as any)?.data?.status || (indexResp as any)?.status;
        
        console.log(`[Node] Indexing response - status: ${indexStatus}, task_id: ${taskIdFromTask}`);
        
        if (!taskIdFromTask) {
          console.error('❌ No task_id returned from indexing endpoint. Response:', JSON.stringify(indexResp, null, 2));
        } else {
          console.log(`✅ Indexing started with task_id: ${taskIdFromTask}`);
        }
      }

      // 2. Perform Segmentation (Async - Don't wait for completion due to Vercel timeout limits)
      // Vercel serverless functions have execution time limits (10-60s), but segmentation can take 15+ minutes
      // So we trigger it asynchronously and let it complete in the background
      if (taskIdFromTask) {
        console.log(`[Node] Triggering async segmentation for ${lectureId} with task_id: ${taskIdFromTask}...`);
        
        // Fire and forget - don't await (Vercel will timeout if we wait)
        // Flask will process this in the background and can take 15+ minutes
        flask.post('/api/segment-video', {
          videoUrl: signedDownloadUrl,
          lectureId,
          videoId: videoIdFromTask,
          taskId: taskIdFromTask,
        }).then((segResp) => {
          if (segResp.data?.status === 'success') {
            const asyncSegments = segResp.data?.segments || [];
            const asyncFullAiData = segResp.data?.rawAiMetaData || null;
            const asyncVideoId = segResp.data?.video_id || videoIdFromTask;
            
            console.log("--- ASYNC SEGMENTATION COMPLETE ---");
            console.log("Lecture ID:", lectureId);
            console.log("Video ID:", asyncVideoId);
            console.log("Segments Length:", asyncSegments.length);
            console.log(`✅ Successfully received ${asyncSegments.length} segments from TwelveLabs (async).`);
            
            // Update the lecture in the database with segments (async)
            // This happens after the upload/complete response is sent
            updateLectureWithSegments(lectureId, courseId, asyncSegments, asyncFullAiData, asyncVideoId).catch(err => {
              console.error('[Node] Failed to update lecture with segments:', err);
            });
          } else {
            console.error('❌ Async segmentation failed. Response:', JSON.stringify(segResp.data, null, 2));
          }
        }).catch((segErr: any) => {
          console.error('[Node] Async segmentation error:', segErr.message);
          if (segErr.response) {
            console.error('[Node] Async segmentation error response:', segErr.response.data);
            console.error('[Node] Async segmentation error status:', segErr.response.status);
          }
        });
        
        console.log(`✅ Segmentation triggered asynchronously. It will complete in the background (may take 15+ minutes).`);
      } else {
        console.warn('[Node] No task_id available, skipping segmentation.');
      }
    }

    const videoUrl = getVideoUrl(videoKey);
    
    // Transform segments to match ILecture format (map startTime->start, endTime->end, name->title if needed)
    const lectureSegments = segments.map((seg: any) => ({
      start: seg.start || seg.startTime || 0,
      end: seg.end || seg.endTime || 0,
      title: seg.title || seg.name || 'Untitled Segment',
      summary: seg.summary || ''
    }));
    
    const lectureData = {
      lectureId,
      lectureTitle: lectureTitle || 'Untitled Lecture',
      courseId,
      videoUrl,
      createdAt: new Date(),
      studentRewindEvents: [],
      lectureSegments: lectureSegments.length > 0 ? lectureSegments : undefined,
      rawAiMetaData: fullAiData || {}
    };

    // D. Update Course Model (Update existing or push new)
    const courseLectureIndex = course.lectures.findIndex(l => l.lectureId === lectureId);
    if (courseLectureIndex > -1) {
      // Use Object.assign or spread to update existing sub-doc
      Object.assign(course.lectures[courseLectureIndex], lectureData);
      course.markModified('lectures');
    } else {
      course.lectures.push(lectureData);
    }
    await course.save();

    // E. Update Lecturer Model (Update existing or push new)
    let lecturer = await Lecturer.findOne({ userId });
    if (!lecturer) {
      lecturer = new Lecturer({ userId, lectures: [lectureData] });
    } else {
      const lecturerLectureIndex = lecturer.lectures.findIndex(l => l.lectureId === lectureId);
      if (lecturerLectureIndex > -1) {
        Object.assign(lecturer.lectures[lecturerLectureIndex], lectureData);
        lecturer.markModified('lectures');
      } else {
        lecturer.lectures.push(lectureData);
      }
    }
    await lecturer.save();

    res.status(200).json({
      success: true,
      message: taskIdFromTask 
        ? 'Upload completed. Video indexing is processing in the background (may take 15+ minutes). Segments will appear automatically when ready.'
        : 'Upload completed and database updated',
      data: { 
        lectureId, 
        segments: segments.length > 0 ? segments : [],
        indexingInProgress: !!taskIdFromTask && segments.length === 0
      },
    });

  } catch (error: any) {
    console.error('❌ Error completing upload:', error);
    // Send the actual error message back to help debug
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// 3. Direct upload (Server-side proxy)
router.post('/direct', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const lectureId = req.headers['x-lecture-id'] as string;
    const filename = req.headers['x-filename'] as string;
    const contentType = req.headers['content-type'] || 'video/mp4';

    if (!userId || !lectureId || !filename) {
      return res.status(400).json({ error: 'Missing required headers' });
    }

    const key = generateVideoKey(userId, lectureId, filename);
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.body,
      ContentType: contentType,
    });

    await s3Client.send(command);

    res.status(200).json({
      success: true,
      data: { key, videoUrl: getVideoUrl(key), lectureId },
    });
  } catch (error) {
    console.error('Direct upload failed:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// 4. Webhook endpoint for Flask to call when segmentation completes
router.post('/segmentation-complete', async (req: Request, res: Response) => {
  try {
    const { lectureId, courseId, segments, rawAiMetaData, videoId } = req.body;

    if (!lectureId || !segments) {
      return res.status(400).json({ error: 'Missing required fields: lectureId, segments' });
    }

    console.log(`[Node] Received segmentation completion webhook for lecture ${lectureId} with ${segments.length} segments`);

    await updateLectureWithSegments(lectureId, courseId, segments, rawAiMetaData, videoId);

    res.status(200).json({ success: true, message: 'Segments updated' });
  } catch (error: any) {
    console.error('❌ Error handling segmentation webhook:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// 5. Generate presigned URL for video playback (streaming)
router.get('/stream/:videoKey', async (req: Request, res: Response) => {
  try {
    const { videoKey } = req.params;
    const videoKeyString = Array.isArray(videoKey) ? videoKey[0] : videoKey;

    if (!BUCKET_NAME) {
      return res.status(500).json({ error: 'R2 bucket configuration missing' });
    }

    // Decode video key if it's URL encoded
    const decodedKey = decodeURIComponent(videoKeyString);

    // Generate presigned URL for GetObject (supports range requests for streaming)
    const command = new GetObjectCommand({ 
      Bucket: BUCKET_NAME, 
      Key: decodedKey,
      // ResponseContentType is optional, but can help with browser compatibility
    });

    // Generate presigned URL that expires in 1 hour (3600 seconds)
    // Presigned URLs from R2/S3 support HTTP range requests automatically
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.status(200).json({
      success: true,
      streamUrl: presignedUrl,
      expiresIn: 3600,
    });
  } catch (error: any) {
    console.error('Error generating stream URL:', error);
    
    if (error.name === 'NoSuchKey') {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.status(500).json({ error: 'Failed to generate stream URL' });
  }
});

export default router;