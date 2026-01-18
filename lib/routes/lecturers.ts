import express, { Request, Response } from 'express';
import { Lecturer } from '../models/Lecturer.js';

const router = express.Router();

// NOTE: Ensure your R2 bucket has CORS configured:
// In Cloudflare R2 dashboard, add these CORS rules:
// Allowed Origins: * (or your specific domain)
// Allowed Methods: GET, HEAD
// Allowed Headers: *
// Max Age: 3600

// Create or update lecturer with a lecture
router.post('/:userId/lectures', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { lectureId, lectureTitle, courseId } = req.body;

    if (!lectureId || !lectureTitle || !courseId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let lecturer = await Lecturer.findOne({ userId });

    if (!lecturer) {
      lecturer = new Lecturer({
        userId,
        lectures: [{
          lectureId,
          lectureTitle,
          courseId,
          createdAt: new Date(),
          studentRewindEvents: [],
        }],
      });
    } else {
      // Check if lecture already exists
      const existingLecture = lecturer.lectures.find(l => l.lectureId === lectureId);
      
      if (!existingLecture) {
        lecturer.lectures.push({
          lectureId,
          lectureTitle,
          courseId,
          createdAt: new Date(),
          rawAiMetaData: {},
          studentRewindEvents: [],
        });
      }
    }

    await lecturer.save();

    res.status(200).json({ success: true, data: lecturer });
  } catch (error) {
    console.error('Error updating lecturer lectures:', error);
    res.status(500).json({ error: 'Failed to update lecturer lectures' });
  }
});

// Get lecturer data
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const lecturer = await Lecturer.findOne({ userId });

    if (!lecturer) {
      return res.status(404).json({ error: 'Lecturer not found' });
    }

    res.status(200).json({ success: true, data: lecturer });
  } catch (error) {
    console.error('Error fetching lecturer data:', error);
    res.status(500).json({ error: 'Failed to fetch lecturer data' });
  }
});

export default router;
