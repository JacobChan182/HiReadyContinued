import express, { Request, Response } from 'express';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';
import { s3Client, BUCKET_NAME, generateVideoKey, getVideoUrl } from '../utils/r2';
import { Lecturer } from '../models/Lecturer';
import { Course } from '../models/Course';

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
    const health = await tryFlask(() => flask.get('/health'), 'Flask health check');
    if (health) {
      // 1. Start Indexing
      const indexResp = await tryFlask(
        () => flask.post('/api/index-video', { videoUrl: signedDownloadUrl, lectureId }),
        'Indexing trigger'
      );
      videoIdFromTask = (indexResp as any)?.data?.video_id || null;
      taskIdFromTask = (indexResp as any)?.data?.task_id || null;

      // 2. Perform Segmentation (Wait for it)
      const flaskLong = axios.create({ baseURL: FLASK_BASE_URL, timeout: 600000 }); // 10 min timeout
      try {
        console.log(`[Node] Requesting segmentation for ${lectureId}...`);
        const segResp = await flaskLong.post('/api/segment-video', {
          videoUrl: signedDownloadUrl,
          lectureId,
          videoId: videoIdFromTask,
          taskId: taskIdFromTask,
        });
        
        segments = segResp.data?.segments || [];
        fullAiData = segResp.data?.rawAiMetaData || null;
        // LOG THIS IN YOUR TERMINAL
        console.log("--- DATA VALIDATION ---");
        console.log("Lecture ID:", lectureId);
        console.log("Segments Length:", segments.length);
        console.log("Full AI Data Type:", typeof fullAiData);
        console.log("Full AI Data Content:", JSON.stringify(fullAiData).substring(0, 100));
        console.log(`[Node] Received ${segments.length} segments.`);
      } catch (segErr: any) {
        console.error('[Node] Segmentation error:', segErr.message);
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
      message: 'Upload completed and database updated',
      data: { lectureId, segments },
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

// 4. Generate presigned URL for video playback (streaming)
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