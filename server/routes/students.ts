import express, { Request, Response } from 'express';
import { Student } from '../models/Student';
import { Course } from '../models/Course';

const router = express.Router();

// Get student data
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const student = await Student.findOne({ userId });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.status(200).json({ success: true, data: student });
  } catch (error) {
    console.error('Error fetching student data:', error);
    res.status(500).json({ error: 'Failed to fetch student data' });
  }
});

// Get student courses and lectures
router.get('/:userId/courses', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const student = await Student.findOne({ userId });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get all courses the student is enrolled in
    const courses = await Course.find({ courseId: { $in: student.courseIds } });

    // Transform courses and lectures to match frontend format
    const transformedCourses = courses.map(course => ({
      id: course.courseId,
      name: course.courseName,
      code: course.courseId,
      instructorId: course.instructorId,
      lectureIds: course.lectures.map(l => l.lectureId),
    }));

    // Transform all lectures from all courses, with segments from rawAiMetaData/segments
    const allLectures = courses.flatMap(course =>
      course.lectures.map(lecture => {
        // Extract segments from rawAiMetaData.segments
        const rawSegments = lecture.rawAiMetaData?.segments || [];
        // Transform segments to match LectureSegment format
        const lectureSegments = Array.isArray(rawSegments) ? rawSegments.map((seg: any) => ({
          start: seg.start || seg.startTime || 0,
          end: seg.end || seg.endTime || 0,
          title: seg.title || seg.name || 'Untitled Segment',
          summary: seg.summary || '',
          count: seg.count !== undefined ? seg.count : 0
        })) : [];

        return {
          id: lecture.lectureId,
          title: lecture.lectureTitle,
          courseId: course.courseId,
          videoUrl: lecture.videoUrl || '',
          duration: 0, // Duration not stored in DB, will need to be calculated or stored
          concepts: [], // Concepts not stored in DB, will need separate fetch
          lectureSegments: lectureSegments,
          uploadedAt: lecture.createdAt ? new Date(lecture.createdAt) : new Date(),
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        courses: transformedCourses,
        lectures: allLectures,
      },
    });
  } catch (error) {
    console.error('Error fetching student courses:', error);
    res.status(500).json({ error: 'Failed to fetch student courses' });
  }
});

// Assign lecture to student
router.post('/:userId/lectures', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { lectureId, lectureTitle, courseId } = req.body;

    if (!lectureId || !lectureTitle || !courseId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const student = await Student.findOne({ userId });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check if lecture already assigned
    const existingLecture = student.lectures.find(l => l.lectureId === lectureId);
    
    if (!existingLecture) {
      student.lectures.push({
        lectureId,
        lectureTitle,
        courseId,
        assignedAt: new Date(),
        rewindEvents: [],
      });
    }

    await student.save();

    res.status(200).json({ success: true, data: student });
  } catch (error) {
    console.error('Error assigning lecture to student:', error);
    res.status(500).json({ error: 'Failed to assign lecture' });
  }
});

export default router;
