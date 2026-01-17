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

// Get student courses and lectures
export const getStudentCourses = async (userId: string) => {
  try {
    const response = await fetch(`${API_URL}/students/${userId}/courses`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: true, data: { courses: [], lectures: [] } };
      }
      throw new Error('Failed to fetch student courses');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching student courses:', error);
    throw error;
  }
};

// Update course information
export const updateCourse = async (courseId: string, courseName?: string, newCourseId?: string) => {
  try {
    const response = await fetch(`${API_URL}/courses/${courseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        courseName,
        newCourseId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update course');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating course:', error);
    throw error;
  }
};

// Get students enrolled in a course
export const getCourseStudents = async (courseId: string) => {
  try {
    const response = await fetch(`${API_URL}/courses/${courseId}/students`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch course students');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching course students:', error);
    throw error;
  }
};

// Add students to a course
export const addStudentsToCourse = async (courseId: string, studentEmails: string[]) => {
  try {
    const response = await fetch(`${API_URL}/courses/${courseId}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentEmails,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add students to course');
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding students to course:', error);
    throw error;
  }
};

// Remove a student from a course
export const removeStudentFromCourse = async (courseId: string, userId: string) => {
  try {
    const response = await fetch(`${API_URL}/courses/${courseId}/students/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove student from course');
    }

    return await response.json();
  } catch (error) {
    console.error('Error removing student from course:', error);
    throw error;
  }
};

// Search for users by email
export const searchUsers = async (email: string) => {
  try {
    const response = await fetch(`${API_URL}/courses/search/users?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to search users');
    }

    return await response.json();
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

// Get presigned streaming URL for video playback
export const getVideoStreamUrl = async (videoKey: string) => {
  try {
    const encodedKey = encodeURIComponent(videoKey);
    const response = await fetch(`${API_URL}/upload/stream/${encodedKey}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get video stream URL');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting video stream URL:', error);
    throw error;
  }
};
