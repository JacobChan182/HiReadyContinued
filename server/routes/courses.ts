import express, { Request, Response } from 'express';
import { Course } from '../models/Course';
import { User } from '../models/User';
import { Student } from '../models/Student';

const router = express.Router();

// Create a new course
router.post('/', async (req: Request, res: Response) => {
  try {
    const { courseId, courseName, instructorId, studentEmails } = req.body;

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

    // Assign students to course if emails provided
    const assignedStudents: string[] = [];
    const notFoundEmails: string[] = [];
    
    if (studentEmails && Array.isArray(studentEmails) && studentEmails.length > 0) {
      for (const email of studentEmails) {
        try {
          // Find user by email
          const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'student' });
          
          if (user) {
            // Update User model to include courseId
            if (!user.courseIds.includes(courseId)) {
              user.courseIds.push(courseId);
              await user.save();
            }

            // Update or create Student model
            let student = await Student.findOne({ userId: user._id.toString() });
            
            if (!student) {
              // Create new student record
              student = new Student({
                userId: user._id.toString(),
                pseudonymId: user.pseudonymId,
                courseIds: [courseId],
                lectures: [],
              });
            } else {
              // Add courseId if not already present
              if (!student.courseIds.includes(courseId)) {
                student.courseIds.push(courseId);
              }
            }
            
            await student.save();
            assignedStudents.push(email);
          } else {
            notFoundEmails.push(email);
          }
        } catch (error) {
          console.error(`Error assigning student ${email} to course:`, error);
          notFoundEmails.push(email);
        }
      }
    }

    res.status(201).json({ 
      success: true, 
      data: newCourse,
      assignedStudents,
      notFoundEmails: notFoundEmails.length > 0 ? notFoundEmails : undefined,
    });
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

// Update course information (name, code)
router.put('/:courseId', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const { courseName, newCourseId } = req.body;

    const course = await Course.findOne({ courseId });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // If newCourseId is provided and different, check if it's available
    if (newCourseId && newCourseId !== courseId) {
      const existingCourse = await Course.findOne({ courseId: newCourseId });
      if (existingCourse) {
        return res.status(409).json({ error: 'A course with this ID already exists' });
      }
      
      // Update courseId - need to update all related documents
      const oldCourseId = course.courseId;
      course.courseId = newCourseId;
      
      // Update User records - replace courseId in array
      const users = await User.find({ courseIds: oldCourseId });
      for (const user of users) {
        const index = user.courseIds.indexOf(oldCourseId);
        if (index !== -1) {
          user.courseIds[index] = newCourseId;
          await user.save();
        }
      }

      // Update Student records - replace courseId in array and update lecture courseIds
      const students = await Student.find({ courseIds: oldCourseId });
      for (const student of students) {
        const index = student.courseIds.indexOf(oldCourseId);
        if (index !== -1) {
          student.courseIds[index] = newCourseId;
        }
        // Update lecture courseIds
        student.lectures.forEach(lecture => {
          if (lecture.courseId === oldCourseId) {
            lecture.courseId = newCourseId;
          }
        });
        await student.save();
      }

      // Update lecture courseIds in Course model
      course.lectures.forEach(lecture => {
        lecture.courseId = newCourseId;
      });
    }

    // Update course name if provided
    if (courseName) {
      course.courseName = courseName;
    }

    await course.save();

    res.status(200).json({ success: true, data: course });
  } catch (error: any) {
    console.error('Error updating course:', error);
    
    if (error.code === 11000 && error.keyPattern?.courseId) {
      return res.status(409).json({ error: 'A course with this ID already exists' });
    }
    
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// Get students enrolled in a course
router.get('/:courseId/students', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findOne({ courseId });
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Find all users with this courseId
    const users = await User.find({ courseIds: courseId, role: 'student' });
    
    const students = users.map(user => ({
      userId: user._id.toString(),
      email: user.email,
      pseudonymId: user.pseudonymId,
      cluster: user.cluster,
    }));

    res.status(200).json({ success: true, data: students });
  } catch (error) {
    console.error('Error fetching course students:', error);
    res.status(500).json({ error: 'Failed to fetch course students' });
  }
});

// Add students to a course by email
router.post('/:courseId/students', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const { studentEmails } = req.body;

    if (!studentEmails || !Array.isArray(studentEmails) || studentEmails.length === 0) {
      return res.status(400).json({ error: 'studentEmails array is required' });
    }

    const course = await Course.findOne({ courseId });
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const assignedStudents: string[] = [];
    const notFoundEmails: string[] = [];

    for (const email of studentEmails) {
      try {
        const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'student' });

        if (user) {
          // Update User model
          if (!user.courseIds.includes(courseId)) {
            user.courseIds.push(courseId);
            await user.save();
          }

          // Update or create Student model
          let student = await Student.findOne({ userId: user._id.toString() });

          if (!student) {
            student = new Student({
              userId: user._id.toString(),
              pseudonymId: user.pseudonymId,
              courseIds: [courseId],
              lectures: [],
            });
          } else {
            if (!student.courseIds.includes(courseId)) {
              student.courseIds.push(courseId);
            }
          }

          await student.save();
          assignedStudents.push(email);
        } else {
          notFoundEmails.push(email);
        }
      } catch (error) {
        console.error(`Error adding student ${email} to course:`, error);
        notFoundEmails.push(email);
      }
    }

    res.status(200).json({
      success: true,
      assignedStudents,
      notFoundEmails: notFoundEmails.length > 0 ? notFoundEmails : undefined,
    });
  } catch (error) {
    console.error('Error adding students to course:', error);
    res.status(500).json({ error: 'Failed to add students to course' });
  }
});

// Remove a student from a course
router.delete('/:courseId/students/:userId', async (req: Request, res: Response) => {
  try {
    const { courseId, userId } = req.params;

    const course = await Course.findOne({ courseId });
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Remove courseId from User
    const user = await User.findById(userId);
    if (user) {
      user.courseIds = user.courseIds.filter(id => id !== courseId);
      await user.save();
    }

    // Remove courseId from Student
    const student = await Student.findOne({ userId });
    if (student) {
      student.courseIds = student.courseIds.filter(id => id !== courseId);
      // Also remove lectures from this course
      student.lectures = student.lectures.filter(l => l.courseId !== courseId);
      await student.save();
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error removing student from course:', error);
    res.status(500).json({ error: 'Failed to remove student from course' });
  }
});

// Search for users by email
router.get('/search/users', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email query parameter is required' });
    }

    // Search for users with matching email (student role only)
    const users = await User.find({
      email: { $regex: email.toLowerCase().trim(), $options: 'i' },
      role: 'student',
    }).limit(10);

    const results = users.map(user => ({
      userId: user._id.toString(),
      email: user.email,
      pseudonymId: user.pseudonymId,
    }));

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

export default router;
