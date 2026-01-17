import express, { Request, Response } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME, generateVideoKey, getVideoUrl } from '../utils/r2';
import { Lecturer } from '../models/Lecturer';
import axios from 'axios';

const router = express.Router();

// Generate presigned URL for video upload
router.post('/presigned-url', async (req: Request, res: Response) => {
  try {
    const { userId, lectureId, filename, contentType } = req.body;

    // Validate required fields
    if (!userId || !lectureId || !filename) {
      return res.status(400).json({ error: 'Missing required fields: userId, lectureId, filename' });
    }

    // Validate R2 configuration
    if (!BUCKET_NAME) {
      console.error('R2_BUCKET_NAME is not configured');
      return res.status(500).json({ error: 'R2 bucket name not configured. Please check your environment variables.' });
    }

    // Validate file type
    const validExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension || !validExtensions.includes(extension)) {
      return res.status(400).json({ error: 'Invalid file type. Only video files are allowed.' });
    }

    // Generate unique key for the video
    const key = generateVideoKey(userId, lectureId, filename);

    // Create PutObject command
    // Note: R2 doesn't support ACL. Make sure your R2 bucket has a public access policy configured
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || `video/${extension}`,
    });

    // Generate presigned URL (valid for 1 hour)
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.status(200).json({
      success: true,
      presignedUrl,
      key,
      publicUrl: getVideoUrl(key),
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    console.error('Error details:', errorDetails);
    res.status(500).json({ 
      error: 'Failed to generate upload URL',
      details: errorMessage 
    });
  }
});

// Complete upload - save video URL to lecture
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { userId, lectureId, videoKey, lectureTitle, courseId } = req.body;
    
    if (!userId || !lectureId || !videoKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get or create lecturer
    let lecturer = await Lecturer.findOne({ userId });

    if (!lecturer) {
      lecturer = new Lecturer({
        userId,
        lectures: [],
      });
    }

    // Get public URL for the video
    const videoUrl = getVideoUrl(videoKey);

    try {
      await axios.post('http://127.0.0.1:5000/api/index-video', {
        videoUrl: videoUrl,
        lectureId: lectureId
      });
      console.log('Successfully notified Flask to start indexing.');
    } catch (flaskError) {
      console.error('Failed to notify Flask:', flaskError.message);
      // We don't necessarily want to fail the whole upload if the AI trigger fails
    }

    // Find or create the lecture
    const lecture = lecturer.lectures.find(l => l.lectureId === lectureId);

    if (lecture) {
      // Update existing lecture with video URL
      lecture.videoUrl = videoUrl;
    } else {
      // Create new lecture entry
      lecturer.lectures.push({
        lectureId,
        lectureTitle: lectureTitle || 'Untitled Lecture',
        courseId: courseId || 'default-course',
        videoUrl,
        createdAt: new Date(),
        studentRewindEvents: [],
      });
    }

    await lecturer.save();

    res.status(200).json({
      success: true,
      message: 'Video upload completed',
      data: {
        lectureId,
        videoUrl,
      },
    });
  } catch (error) {
    console.error('Error completing upload:', error);
    res.status(500).json({ error: 'Failed to save video metadata' });
  }
});

// Direct upload endpoint - uploads file to R2 via server (avoids CORS)
router.post('/direct', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const lectureId = req.headers['x-lecture-id'] as string;
    const filename = req.headers['x-filename'] as string;
    const contentType = req.headers['content-type'] || 'video/mp4';

    // Validate required fields
    if (!userId || !lectureId || !filename) {
      return res.status(400).json({ error: 'Missing required headers: x-user-id, x-lecture-id, x-filename' });
    }

    // Validate R2 configuration
    if (!BUCKET_NAME) {
      console.error('R2_BUCKET_NAME is not configured');
      return res.status(500).json({ error: 'R2 bucket name not configured' });
    }

    // Validate file type
    const validExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension || !validExtensions.includes(extension)) {
      return res.status(400).json({ error: 'Invalid file type. Only video files are allowed.' });
    }

    // Generate unique key for the video
    const key = generateVideoKey(userId, lectureId, filename);

    // Upload file to R2
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.body,
      ContentType: contentType,
    });

    await s3Client.send(command);

    // Get public URL
    const videoUrl = getVideoUrl(key);

    res.status(200).json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        key,
        videoUrl,
        lectureId,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to upload file',
      details: errorMessage 
    });
  }
});

export default router;
