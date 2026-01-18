import express, { Request, Response } from 'express';
import { Login } from '../models/Login.js';

const router = express.Router();

// Track login/signup event
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      pseudonymId,
      role,
      action, // 'signin' or 'signup'
      ipAddress,
      userAgent,
    } = req.body;

    if (!userId || !pseudonymId || !role || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const loginEvent = new Login({
      userId,
      pseudonymId,
      role,
      action,
      ipAddress: ipAddress || req.ip,
      userAgent: userAgent || req.get('user-agent'),
      timestamp: new Date(),
    });

    await loginEvent.save();

    res.status(200).json({ success: true, message: 'Login event tracked', data: loginEvent });
  } catch (error) {
    console.error('Error tracking login event:', error);
    res.status(500).json({ error: 'Failed to track login event' });
  }
});

// Get login history for a user
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const loginEvents = await Login.find({ userId })
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    res.status(200).json({ success: true, data: loginEvents });
  } catch (error) {
    console.error('Error fetching login history:', error);
    res.status(500).json({ error: 'Failed to fetch login history' });
  }
});

export default router;
