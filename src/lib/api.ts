const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Sign up
export const signup = async (email: string, password: string, role: 'student' | 'instructor') => {
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sign up');
    }

    return await response.json();
  } catch (error) {
    console.error('Signup error:', error);
    throw error;
  }
};

// Sign in
export const signin = async (email: string, password: string) => {
  try {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sign in');
    }

    return await response.json();
  } catch (error) {
    console.error('Signin error:', error);
    throw error;
  }
};

// Track rewind event
export const trackRewindEvent = async (
  userId: string,
  pseudonymId: string,
  lectureId: string,
  lectureTitle: string,
  courseId: string,
  rewindEvent: {
    id: string;
    fromTime: number;
    toTime: number;
    rewindAmount: number;
    fromConceptId?: string;
    fromConceptName?: string;
    toConceptId?: string;
    toConceptName?: string;
    timestamp: number;
    createdAt: Date;
  }
) => {
  try {
    const response = await fetch(`${API_URL}/analytics/rewind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        pseudonymId,
        lectureId,
        lectureTitle,
        courseId,
        rewindEvent,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to track rewind event');
    }

    return await response.json();
  } catch (error) {
    console.error('Error tracking rewind event:', error);
    throw error;
  }
};

// Track login/signup event
export const trackLoginEvent = async (
  userId: string,
  pseudonymId: string,
  role: 'student' | 'instructor',
  action: 'signin' | 'signup'
) => {
  try {
    const response = await fetch(`${API_URL}/logins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        pseudonymId,
        role,
        action,
        // Note: IP address and user agent would typically be captured server-side
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to track login event');
    }

    return await response.json();
  } catch (error) {
    console.error('Error tracking login event:', error);
    throw error;
  }
};
