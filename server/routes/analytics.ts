import express, { Request, Response } from 'express';
import { Student } from '../models/Student';
import { Course } from '../models/Course';

const router = express.Router();

// Helper function to ensure MongoDB connection
async function ensureMongoConnection(): Promise<void> {
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
      throw new Error('Database connection failed. Please check your MongoDB configuration.');
    }
    
    if (mongoose.default.connection.readyState !== CONNECTED_STATE) {
      console.error('❌ MongoDB still not connected after retry. Ready state:', mongoose.default.connection.readyState);
      throw new Error('Database connection not established. Please try again.');
    }
  }
}

// Track rewind event for a student
router.post('/rewind', async (req: Request, res: Response) => {
  try {
    // Ensure MongoDB is connected
    await ensureMongoConnection();

    const {
      userId,
      pseudonymId,
      lectureId,
      lectureTitle,
      courseId,
      rewindEvent,
    } = req.body;

    console.log('[rewind] incoming', {
      userId,
      pseudonymId,
      lectureId,
      lectureTitle,
      courseId,
      rewindEvent,
    });

    if (!userId || !lectureId || !rewindEvent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Update Student collection
    const student = await Student.findOne({ userId });
    
    if (!student) {
      // Create new student if doesn't exist
      const newStudent = new Student({
        userId,
        pseudonymId,
        courseIds: [courseId],
        lectures: [{
          lectureId,
          lectureTitle,
          courseId,
          assignedAt: new Date(),
          rewindEvents: [rewindEvent],
          lastAccessedAt: new Date(),
        }],
      });
      newStudent.markModified('lectures');
      await newStudent.save();
      console.log('[rewind] created student and stored rewind', {
        userId,
        lectureId,
      });
    } else {
      // Update existing student
      const lectureProgress = student.lectures.find(l => l.lectureId === lectureId);
      
      if (!lectureProgress) {
        // Add new lecture assignment
        student.lectures.push({
          lectureId,
          lectureTitle,
          courseId,
          assignedAt: new Date(),
          rewindEvents: [rewindEvent],
          lastAccessedAt: new Date(),
        });
      } else {
        // Add rewind event to existing lecture
        lectureProgress.rewindEvents.push(rewindEvent);
        lectureProgress.lastAccessedAt = new Date();
      }
      
      student.markModified('lectures');
      await student.save();
      console.log('[rewind] updated student rewind', {
        userId,
        lectureId,
        totalRewinds: lectureProgress?.rewindEvents?.length || 0,
      });
    }

    // Update Course collection
    // Find course by courseId
    let course = await Course.findOne({ courseId });
    
    if (!course) {
      // Course doesn't exist - this shouldn't happen if courses are created properly
      // But we'll log it and continue (student data is already saved)
      console.warn(`Course ${courseId} not found when tracking rewind event`);
    } else {
      // Find lecture within the course
      let lecture = course.lectures.find(l => l.lectureId === lectureId);
      
      if (!lecture) {
        // Lecture doesn't exist in course - add it
        course.lectures.push({
          lectureId,
          lectureTitle,
          courseId,
          createdAt: new Date(),
          studentRewindEvents: [{
            studentId: userId,
            studentPseudonymId: pseudonymId,
            rewindEvents: [rewindEvent],
          }],
        });
        course.markModified('lectures');
        await course.save();
      } else {
        // Lecture exists, add rewind event
        let studentRewindData = lecture.studentRewindEvents.find(
          s => s.studentId === userId
        );
        
        if (!studentRewindData) {
          // Add new student to lecture
          lecture.studentRewindEvents.push({
            studentId: userId,
            studentPseudonymId: pseudonymId,
            rewindEvents: [rewindEvent],
          });
        } else {
          // Add rewind event to existing student
          studentRewindData.rewindEvents.push(rewindEvent);
        }
        
        course.markModified('lectures');
        await course.save();
        console.log('[rewind] updated course lecture rewind', {
          courseId,
          lectureId,
        });
      }
    }

    res.status(200).json({ success: true, message: 'Rewind event tracked' });
  } catch (error) {
    console.error('Error tracking rewind event:', error);
    res.status(500).json({ error: 'Failed to track rewind event' });
  }
});

// Update watch progress for a student's lecture
router.post('/watch-progress', async (req: Request, res: Response) => {
  try {
    // Ensure MongoDB is connected
    await ensureMongoConnection();

    const {
      userId,
      lectureId,
      courseId,
      lectureTitle,
      currentTime, // Current video time in seconds
      watchedTimestamps, // Array of timestamps that have been watched (optional, for fine-grained tracking)
    } = req.body;

    if (!userId || !lectureId || currentTime === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const student = await Student.findOne({ userId });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    let lectureProgress = student.lectures.find(l => l.lectureId === lectureId);
    
    if (!lectureProgress) {
      // Create new lecture progress
      lectureProgress = {
        lectureId,
        lectureTitle: lectureTitle || 'Untitled Lecture',
        courseId: courseId || '',
        assignedAt: new Date(),
        rewindEvents: [],
        lastAccessedAt: new Date(),
        maxWatchedTimestamp: currentTime,
        watchedTimestamps: watchedTimestamps || [],
      };
      student.lectures.push(lectureProgress);
    } else {
      // Update existing lecture progress
      lectureProgress.lastAccessedAt = new Date();
      
      // Initialize fields if they don't exist (for existing students)
      if (lectureProgress.maxWatchedTimestamp === undefined) {
        lectureProgress.maxWatchedTimestamp = 0;
      }
      if (lectureProgress.watchedTimestamps === undefined) {
        lectureProgress.watchedTimestamps = [];
      }
      
      // Update max watched timestamp if current time is greater
      if (currentTime > (lectureProgress.maxWatchedTimestamp || 0)) {
        lectureProgress.maxWatchedTimestamp = currentTime;
      }
      
      // Merge watched timestamps if provided
      if (watchedTimestamps && Array.isArray(watchedTimestamps)) {
        const existing = lectureProgress.watchedTimestamps || [];
        const merged = [...new Set([...existing, ...watchedTimestamps])].sort((a, b) => a - b);
        lectureProgress.watchedTimestamps = merged;
      }
    }
    
    await student.save();

    res.status(200).json({ success: true, message: 'Watch progress updated' });
  } catch (error) {
    console.error('Error updating watch progress:', error);
    res.status(500).json({ error: 'Failed to update watch progress' });
  }
});

// Get aggregated watch progress for a lecture (for instructor view)
router.get('/lecture/:lectureId/watch-progress', async (req: Request, res: Response) => {
  try {
    // Ensure MongoDB is connected
    await ensureMongoConnection();

    const lectureId = Array.isArray(req.params.lectureId) 
      ? req.params.lectureId[0] 
      : req.params.lectureId;

    // Find all students who have watched this lecture
    const students = await Student.find({ 'lectures.lectureId': lectureId });

    // Get lecture duration from Course model
    const course = await Course.findOne({ 'lectures.lectureId': lectureId });
    const lecture = course?.lectures.find(l => l.lectureId === lectureId);
    const videoDuration = lecture?.rawAiMetaData?.videoDuration || 0;

    // Aggregate watch progress
    const totalStudents = students.length;
    
    // Create retention data: for each second (or 5-second interval), count how many students watched it
    const interval = 5; // 5-second intervals for retention tracking
    
    // Calculate max watched time safely (handle empty students array)
    let maxTime = videoDuration || 0;
    if (students.length > 0) {
      const maxWatchedTimes = students.map(s => {
        const progress = s.lectures.find(l => l.lectureId === lectureId);
        return progress?.maxWatchedTimestamp || 0;
      });
      if (maxWatchedTimes.length > 0) {
        const calculatedMax = Math.max(...maxWatchedTimes);
        if (calculatedMax > maxTime) {
          maxTime = calculatedMax;
        }
      }
    }

    const retentionData = [];
    for (let time = 0; time <= maxTime; time += interval) {
      const watchedCount = students.filter(s => {
        const progress = s.lectures.find(l => l.lectureId === lectureId);
        if (!progress) return false;
        
        // Check if student watched at least up to this timestamp
        const maxWatched = progress.maxWatchedTimestamp || 0;
        if (maxWatched >= time) {
          return true;
        }
        
        // Also check watchedTimestamps array for fine-grained tracking
        if (progress.watchedTimestamps && progress.watchedTimestamps.length > 0) {
          return progress.watchedTimestamps.some(t => t >= time && t < time + interval);
        }
        
        return false;
      }).length;

      const retentionPercentage = totalStudents > 0 
        ? Math.round((watchedCount / totalStudents) * 100) 
        : 0;

      retentionData.push({
        time: Math.round(time),
        viewers: watchedCount,
        retention: retentionPercentage,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        lectureId,
        totalStudents,
        videoDuration: maxTime,
        retentionData,
      },
    });
  } catch (error) {
    console.error('Error getting watch progress:', error);
    res.status(500).json({ error: 'Failed to get watch progress' });
  }
});

// Get segment rewind counts for a lecture (for instructor view)
router.get('/lecture/:lectureId/segment-rewinds', async (req: Request, res: Response) => {
  try {
    // Ensure MongoDB is connected
    await ensureMongoConnection();

    const lectureId = Array.isArray(req.params.lectureId)
      ? req.params.lectureId[0]
      : req.params.lectureId;

    const course = await Course.findOne({ 'lectures.lectureId': lectureId });
    const lecture = course?.lectures.find(l => l.lectureId === lectureId);

    if (!course || !lecture) {
      return res.status(404).json({ error: 'Lecture not found' });
    }

    const segments = Array.isArray(lecture.rawAiMetaData?.segments)
      ? lecture.rawAiMetaData.segments
      : [];

    const finalCounts = segments.map((seg: any) => seg?.accessCount ?? 0);

    const responseSegments = segments.map((seg: any, index: number) => ({
      start: seg.start ?? seg.startTime ?? 0,
      end: seg.end ?? seg.endTime ?? 0,
      title: seg.title ?? seg.name ?? 'Untitled Segment',
      summary: seg.summary ?? '',
      count: finalCounts[index] || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        lectureId,
        segments: responseSegments,
      },
    });
  } catch (error) {
    console.error('Error getting segment rewinds:', error);
    res.status(500).json({ error: 'Failed to get segment rewinds' });
  }
});

export default router;
