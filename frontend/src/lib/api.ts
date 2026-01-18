const DEFAULT_API_URL = import.meta.env.DEV
  ? '/api/js/api'
  : 'http://localhost:3001/api';

const API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

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

// Chat API Functions
// Flask runs on :5001 in `npm run dev` (see package.json dev:flask)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:5001/api';

export const sendChatMessage = async (
  userId: string,
  message: string,
  lectureId?: string,
  videoTitle?: string,
  sessionId?: string
): Promise<{ response: string; session_id: string }> => {
  try {
    const response = await fetch(`${BACKEND_URL}/backboard/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        message,
        lecture_id: lectureId,
        video_title: videoTitle,
        session_id: sessionId,
        provider: 'openai',
        model: 'gpt-4o',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send chat message');
    }

    const data = await response.json();
    return {
      response: data.response || '',
      session_id: data.session_id || sessionId || '',
    };
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
};

export const getChatHistory = async (
  userId: string,
  sessionId?: string,
  limit: number = 50,
  skip: number = 0
): Promise<Array<{ role: string; content: string; timestamp: string }>> => {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      skip: String(skip),
    });
    if (sessionId) params.set('session_id', sessionId);

    const response = await fetch(
      `${BACKEND_URL}/backboard/chat/history/${userId}?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch chat history');
    }

    const data = await response.json();
    return data.messages || [];
  } catch (error) {
    console.error('Error fetching chat history:', error);
    throw error;
  }
};

export const getChatSessions = async (
  userId: string
): Promise<Array<{ session_id: string; title?: string; updated_at?: string }>> => {
  try {
    const response = await fetch(`${BACKEND_URL}/backboard/chat/sessions/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch chat sessions');
    }

    const data = await response.json();
    return data.sessions || [];
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    throw error;
  }
};

export const createChatSession = async (
  userId: string,
  title?: string,
  lectureId?: string,
  videoTitle?: string
): Promise<{ session_id: string; title?: string }> => {
  try {
    const response = await fetch(`${BACKEND_URL}/backboard/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        title,
        lecture_id: lectureId,
        video_title: videoTitle,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create chat session');
    }

    const data = await response.json();
    const session = data.session;
    return {
      session_id: session?.session_id || '',
      title: session?.title,
    };
  } catch (error) {
    console.error('Error creating chat session:', error);
    throw error;
  }
};

export const deleteChatSession = async (
  userId: string,
  sessionId: string
): Promise<{ deleted: boolean; session_id: string }> => {
  try {
    const response = await fetch(`${BACKEND_URL}/backboard/chat/sessions/${userId}/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete chat session');
    }

    const data = await response.json();
    return {
      deleted: Boolean(data.deleted),
      session_id: data.session_id || sessionId,
    };
  } catch (error) {
    console.error('Error deleting chat session:', error);
    throw error;
  }
};

// Video Analytics API Functions

export interface VideoAnalyticsData {
  totalStudents?: number;
  dropOffPoints?: Array<{ timestamp: number; studentCount: number; percentage: number }>;
  rewindFrequency?: Array<{ conceptName: string; rewindCount: number }>;
  engagementScore?: number;
  strugglingSegments?: Array<{ startTime: number; endTime: number; name: string; rewindCount: number }>;
  averageRewindCount?: number;
}

export const getVideoAnalytics = async (
  videoId: string
): Promise<VideoAnalyticsData> => {
  try {
    const response = await fetch(`${BACKEND_URL}/backboard/analyze-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: videoId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch video analytics');
    }

    const data = await response.json();
    return data.analytics || {};
  } catch (error) {
    console.error('Error fetching video analytics:', error);
    throw error;
  }
};

export const getVideoEngagementReport = async (
  lectureId: string
): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/analytics/lecture/${lectureId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch engagement report');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching engagement report:', error);
    throw error;
  }
};
