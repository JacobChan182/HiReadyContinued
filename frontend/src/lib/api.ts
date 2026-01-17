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
export const signin = async (email: string, password: string, role: 'student' | 'instructor') => {
  try {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, role }),
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

// Get instructor courses and lectures
export const getInstructorLectures = async (instructorId: string) => {
  try {
    const response = await fetch(`${API_URL}/courses/instructor/${instructorId}/lectures`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No courses found, return empty data
        return { success: true, data: { lectures: [], courses: [] } };
      }
      throw new Error('Failed to fetch instructor lectures');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching instructor lectures:', error);
    throw error;
  }
};

// Create a new course
export const createCourse = async (courseId: string, courseName: string, instructorId: string, studentEmails?: string[]) => {
  try {
    const response = await fetch(`${API_URL}/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        courseId,
        courseName,
        instructorId,
        studentEmails: studentEmails || [],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create course');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating course:', error);
    throw error;
  }
};

// Get all courses for an instructor
export const getInstructorCourses = async (instructorId: string) => {
  try {
    const response = await fetch(`${API_URL}/courses/instructor/${instructorId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: true, data: [] };
      }
      throw new Error('Failed to fetch courses');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching courses:', error);
    throw error;
  }
};
