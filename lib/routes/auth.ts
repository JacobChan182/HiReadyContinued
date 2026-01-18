import express, { Request, Response } from 'express';
import { User } from '../models/User.js';
import { generatePseudonymId } from '../utils/pseudonym.js';
import { Login } from '../models/Login.js';

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
      // Map old role values to new ones for Login tracking
      const loginRole = role === 'employee' ? 'student' : role === 'trainer' ? 'instructor' : role;
      
      const loginEvent = new Login({
        userId: newUser._id.toString(),
        pseudonymId: newUser.pseudonymId,
        role: loginRole as 'student' | 'instructor',
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

    // Set HTTP-only cookie with user ID
    // On Vercel (HTTPS), always use secure=true. For local dev (HTTP), use secure=false
    const isVercel = process.env.VERCEL === '1';
    const isLocalDev = !isVercel && process.env.NODE_ENV !== 'production';
    res.cookie('userId', newUser._id.toString(), {
      httpOnly: true,
      secure: !isLocalDev, // true on Vercel (HTTPS), false on local (HTTP)
      sameSite: 'lax', // Allows cookies in cross-site requests
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
      // Don't set domain explicitly - browser will set it based on request origin
    });

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
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password, and role are required' });
    }

    if (!['student', 'instructor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "student" or "instructor"' });
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

    // Validate that the user's role matches the requested role
    // Handle potential old role values from database (employee/trainer) by comparing as strings
    const userRoleStr = String(user.role);
    const normalizedUserRole = (userRoleStr === 'employee' ? 'student' : userRoleStr === 'trainer' ? 'instructor' : userRoleStr) as 'student' | 'instructor';
    
    if (normalizedUserRole !== role) {
      return res.status(403).json({ 
        error: `This account is registered as ${user.role}. Please select the correct role.` 
      });
    }

    // Track signin event
    try {
      // Map old role values to new ones for Login tracking (handle any string value)
      const loginRoleStr = String(user.role);
      const loginRole = (loginRoleStr === 'employee' ? 'student' : loginRoleStr === 'trainer' ? 'instructor' : loginRoleStr) as 'student' | 'instructor';
      
      const loginEvent = new Login({
        userId: user._id.toString(),
        pseudonymId: user.pseudonymId,
        role: loginRole as 'student' | 'instructor',
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

    // Set HTTP-only cookie with user ID
    // On Vercel (HTTPS), always use secure=true. For local dev (HTTP), use secure=false
    const isVercel = process.env.VERCEL === '1';
    const isLocalDev = !isVercel && process.env.NODE_ENV !== 'production';
    res.cookie('userId', user._id.toString(), {
      httpOnly: true,
      secure: !isLocalDev, // true on Vercel (HTTPS), false on local (HTTP)
      sameSite: 'lax', // Allows cookies in cross-site requests
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
      // Don't set domain explicitly - browser will set it based on request origin
    });

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

// Get current user from session cookie
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      // Clear invalid cookie (must match cookie options)
      const isVercel = process.env.VERCEL === '1';
      const isLocalDev = !isVercel && process.env.NODE_ENV !== 'production';
      res.clearCookie('userId', { 
        httpOnly: true,
        secure: !isLocalDev,
        sameSite: 'lax',
        path: '/' 
      });
      return res.status(401).json({ error: 'User not found' });
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
      data: userResponse,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Logout - clear cookie
router.post('/logout', async (req: Request, res: Response) => {
  // Must match cookie options when clearing
  const isVercel = process.env.VERCEL === '1';
  const isLocalDev = !isVercel && process.env.NODE_ENV !== 'production';
  res.clearCookie('userId', { 
    httpOnly: true,
    secure: !isLocalDev,
    sameSite: 'lax',
    path: '/' 
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

export default router;
