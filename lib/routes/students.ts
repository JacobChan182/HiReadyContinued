import express, { Request, Response } from 'express';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import { Lecturer } from '../models/Lecturer.js'; // NEW

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

    // Build a quick lookup of lecture segments from Lecturer documents (fallback source)
    const courseLectureIds = courses.flatMap(c => c.lectures.map(l => l.lectureId)).filter(Boolean);
    const lecturerSegmentsById = new Map<string, any[]>();

    if (courseLectureIds.length > 0) {
      const lecturerDocs = await Lecturer.find(
        { 'lectures.lectureId': { $in: courseLectureIds } },
        { lectures: 1, _id: 0 }
      );

      lecturerDocs.forEach(doc => {
        doc.lectures.forEach(lec => {
          const segs = lec?.rawAiMetaData?.segments;
          if (lec?.lectureId && Array.isArray(segs) && segs.length > 0) {
            lecturerSegmentsById.set(lec.lectureId, segs);
          }
        });
      });
    }

    // Transform courses and lectures to match frontend format
    const transformedCourses = courses.map(course => ({
      id: course.courseId,
      name: course.courseName,
      code: course.courseId,
      instructorId: course.instructorId,
      lectureIds: course.lectures.map(l => l.lectureId),
    }));

    // Transform all lectures from all courses, with segments preferring Course.rawAiMetaData.segments, then Lecturer fallback
    const allLectures = courses.flatMap(course =>
      course.lectures.map(lecture => {
        // Prefer course-level segments, fallback to lecturer-level segments
        const rawSegments =
          (Array.isArray(lecture.rawAiMetaData?.segments) ? lecture.rawAiMetaData.segments : null) ??
          lecturerSegmentsById.get(lecture.lectureId) ??
          [];

        const lectureSegments = Array.isArray(rawSegments)
          ? rawSegments.map((seg: any) => ({
              start: seg.start ?? seg.startTime ?? 0,
              end: seg.end ?? seg.endTime ?? 0,
              title: seg.title ?? seg.name ?? 'Untitled Segment',
              summary: seg.summary ?? '',
            }))
          : [];

        return {
          id: lecture.lectureId,
          lectureId: lecture.lectureId,
          lectureTitle: lecture.lectureTitle,
          title: lecture.lectureTitle, // also provide 'title' for frontend convenience
          courseId: course.courseId,
          videoUrl: lecture.videoUrl || '',
          duration: 0, // not stored
          concepts: [], // not stored
          lectureSegments,
          uploadedAt: lecture.createdAt ? new Date(lecture.createdAt) : new Date(),
        };
      })
    );

    // Ensure every lecture has lectureId field
    const formattedLectures = allLectures.map(lec => ({
      ...lec,
      lectureId: lec.lectureId || lec.id?.toString(),
    }));

    console.log('📤 Sending lectures with IDs:', formattedLectures.map(l => ({
      lectureId: l.lectureId,
      lectureTitle: l.lectureTitle,
      segments: Array.isArray(l.lectureSegments) ? l.lectureSegments.length : 0,
    })));

    res.status(200).json({
      success: true,
      data: {
        courses: transformedCourses,
        lectures: formattedLectures,
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
