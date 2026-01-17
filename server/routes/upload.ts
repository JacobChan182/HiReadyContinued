import express, { Request, Response } from 'express';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';
import { s3Client, BUCKET_NAME, generateVideoKey, getVideoUrl } from '../utils/r2';
import { Lecturer } from '../models/Lecturer';
import { Course } from '../models/Course';

const router = express.Router();

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
      return res.status(400).json({ error: 'Missing required fields (userId, lectureId, videoKey, courseId)' });
    }

    // A. Verify Course and Permissions
    const course = await Course.findOne({ courseId });
    if (!course) {
      return res.status(404).json({ error: `Course ${courseId} not found.` });
    }
    if (course.instructorId !== userId) {
      return res.status(403).json({ error: 'Permission denied: You do not own this course' });
    }

    // B. Generate signed URL for Twelve Labs (Flask) access
    const downloadCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: videoKey });
    const signedDownloadUrl = await getSignedUrl(s3Client, downloadCommand, { expiresIn: 3600 });

    // C. Trigger Flask Indexing
    try {
      await axios.post('http://127.0.0.1:5000/api/index-video', {
        videoUrl: signedDownloadUrl,
        lectureId: lectureId
      });
      console.log('Twelve Labs indexing triggered via Flask.');
    } catch (flaskError: any) {
      console.error('Indexing trigger failed:', flaskError.message);
    }

    const videoUrl = getVideoUrl(videoKey);
    const lectureData = {
      lectureId,
      lectureTitle: lectureTitle || 'Untitled Lecture',
      courseId,
      videoUrl,
      createdAt: new Date(),
      studentRewindEvents: [],
    };

    // D. Update Course Model
    const courseLectureIndex = course.lectures.findIndex(l => l.lectureId === lectureId);
    if (courseLectureIndex > -1) {
      course.lectures[courseLectureIndex].videoUrl = videoUrl;
    } else {
      course.lectures.push(lectureData);
    }
    await course.save();

    // E. Update Lecturer Model
    let lecturer = await Lecturer.findOne({ userId });
    if (!lecturer) {
      lecturer = new Lecturer({ userId, lectures: [] });
    }
    const lecturerLectureIndex = lecturer.lectures.findIndex(l => l.lectureId === lectureId);
    if (lecturerLectureIndex > -1) {
      lecturer.lectures[lecturerLectureIndex].videoUrl = videoUrl;
    } else {
      lecturer.lectures.push(lectureData);
    }
    await lecturer.save();

    res.status(200).json({
      success: true,
      message: 'Video upload and metadata synchronization completed',
      data: { lectureId, videoUrl },
    });
  } catch (error) {
    console.error('Error completing upload:', error);
    res.status(500).json({ error: 'Failed to save video metadata across models' });
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

    if (!BUCKET_NAME) {
      return res.status(500).json({ error: 'R2 bucket configuration missing' });
    }

    // Decode video key if it's URL encoded
    const decodedKey = decodeURIComponent(videoKey);

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