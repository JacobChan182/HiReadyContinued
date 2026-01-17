import express, { Request, Response } from 'express';
import { User } from '../models/User';
import { generatePseudonymId } from '../utils/pseudonym';
import { Login } from '../models/Login';

const router = express.Router();

const clusters: string[] = ['high-replay', 'fast-watcher', 'note-taker', 'late-night-learner', 'steady-pacer'];

// Sign up
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password, and role are required' });
    }

    if (!['student', 'instructor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "student" or "instructor"' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate pseudonym ID
    const pseudonymId = generatePseudonymId();

    // Create new user (password will be hashed by pre-save hook)
    const newUser = new User({
      email: email.toLowerCase(),
      password,
      role,
      pseudonymId,
      courseIds: ['course-1', 'course-2'], // Default courses
      cluster: role === 'student' ? clusters[Math.floor(Math.random() * clusters.length)] : undefined,
    });

    await newUser.save();

    // Track signup event
    try {
      const loginEvent = new Login({
        userId: newUser._id.toString(),
        pseudonymId: newUser.pseudonymId,
        role,
        action: 'signup',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        timestamp: new Date(),
      });
      await loginEvent.save();
    } catch (error) {
      console.error('Failed to track signup event:', error);
      // Continue even if tracking fails
    }

    // Return user without password
    const userResponse = {
      id: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role,
      pseudonymId: newUser.pseudonymId,
      courseIds: newUser.courseIds,
      cluster: newUser.cluster,
      createdAt: newUser.createdAt,
    };

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userResponse,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Sign in
router.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Track signin event
    try {
      const loginEvent = new Login({
        userId: user._id.toString(),
        pseudonymId: user.pseudonymId,
        role: user.role,
        action: 'signin',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        timestamp: new Date(),
      });
      await loginEvent.save();
    } catch (error) {
      console.error('Failed to track signin event:', error);
      // Continue even if tracking fails
    }

    // Return user without password
    const userResponse = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      pseudonymId: user.pseudonymId,
      courseIds: user.courseIds,
      cluster: user.cluster,
      createdAt: user.createdAt,
    };

    res.status(200).json({
      success: true,
      message: 'Sign in successful',
      data: userResponse,
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

export default router;
