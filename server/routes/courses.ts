import express, { Request, Response } from 'express';
import { Course } from '../models/Course';

const router = express.Router();

// Create a new course
router.post('/', async (req: Request, res: Response) => {
  try {
    const { courseId, courseName, instructorId } = req.body;

    if (!courseId || !courseName || !instructorId) {
      return res.status(400).json({ error: 'Missing required fields: courseId, courseName, instructorId' });
    }

    // Check if course already exists
    const existingCourse = await Course.findOne({ courseId });
    if (existingCourse) {
      return res.status(409).json({ error: 'Course with this ID already exists' });
    }

    const newCourse = new Course({
      courseId,
      courseName,
      instructorId,
      lectures: [],
    });

    await newCourse.save();

    res.status(201).json({ success: true, data: newCourse });
  } catch (error: any) {
    console.error('Error creating course:', error);
    
    // Handle duplicate key error for old userId index
    if (error.code === 11000 && error.keyPattern?.userId) {
      console.error('⚠️  Old userId index detected. Please restart the server to clean up indexes.');
      return res.status(500).json({ 
        error: 'Database index conflict. Please restart the server to fix this issue.',
        details: 'The database has an old index that needs to be removed. Restarting the server will automatically fix this.'
      });
    }
    
    // Handle duplicate key error for old lectures.lectureId index
    if (error.code === 11000 && error.keyPattern?.['lectures.lectureId']) {
      console.error('⚠️  Old lectures.lectureId index detected. Please restart the server to clean up indexes.');
      return res.status(500).json({ 
        error: 'Database index conflict. Please restart the server to fix this issue.',
        details: 'The database has an old index on lectures.lectureId that needs to be removed. Restarting the server will automatically fix this.'
      });
    }
    
    // Handle duplicate courseId error
    if (error.code === 11000 && error.keyPattern?.courseId) {
      return res.status(409).json({ error: 'Course with this ID already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// Get all courses for an instructor
router.get('/instructor/:instructorId', async (req: Request, res: Response) => {
  try {
    const { instructorId } = req.params;

    const courses = await Course.find({ instructorId });

    res.status(200).json({ success: true, data: courses });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get a specific course by courseId
router.get('/:courseId', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findOne({ courseId });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.status(200).json({ success: true, data: course });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// Add a lecture to a course
router.post('/:courseId/lectures', async (req: Request, res: Response) => {
  try {
    const courseId = Array.isArray(req.params.courseId) 
      ? req.params.courseId[0] 
      : req.params.courseId;
    const { lectureId, lectureTitle, videoUrl } = req.body;

    if (!lectureId || !lectureTitle) {
      return res.status(400).json({ error: 'Missing required fields: lectureId, lectureTitle' });
    }

    let course = await Course.findOne({ courseId });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if lecture already exists
    const existingLecture = course.lectures.find(l => l.lectureId === lectureId);
    
    if (!existingLecture) {
      course.lectures.push({
        lectureId,
        lectureTitle,
        courseId,
        videoUrl: videoUrl || undefined,
        createdAt: new Date(),
        studentRewindEvents: [],
      });
      await course.save();
    }

    res.status(200).json({ success: true, data: course });
  } catch (error) {
    console.error('Error adding lecture to course:', error);
    res.status(500).json({ error: 'Failed to add lecture to course' });
  }
});

// Get all lectures for an instructor (aggregated from all their courses)
router.get('/instructor/:instructorId/lectures', async (req: Request, res: Response) => {
  try {
    const instructorId = Array.isArray(req.params.instructorId) 
      ? req.params.instructorId[0] 
      : req.params.instructorId;

    const courses = await Course.find({ instructorId });

    // Aggregate all lectures from all courses
    const allLectures = courses.flatMap(course => 
      course.lectures.map(lecture => ({
        lectureId: lecture.lectureId,
        lectureTitle: lecture.lectureTitle,
        courseId: course.courseId,
        videoUrl: lecture.videoUrl,
        createdAt: lecture.createdAt,
        studentRewindEvents: lecture.studentRewindEvents,
        courseName: course.courseName,
      }))
    );

    res.status(200).json({ success: true, data: { lectures: allLectures, courses } });
  } catch (error) {
    console.error('Error fetching instructor lectures:', error);
    res.status(500).json({ error: 'Failed to fetch instructor lectures' });
  }
});

export default router;
