import { User, Course, Lecture, Concept, AnalyticsEvent, BehavioralCluster } from '@/types';

// Generate pseudonymous ID
export const generatePseudonymId = (): string => {
  const adjectives = ['Swift', 'Bright', 'Calm', 'Bold', 'Keen', 'Wise', 'Quick', 'Sharp'];
  const animals = ['Fox', 'Owl', 'Bear', 'Wolf', 'Hawk', 'Lion', 'Eagle', 'Tiger'];
  const number = Math.floor(Math.random() * 999) + 1;
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${animals[Math.floor(Math.random() * animals.length)]}${number}`;
};

export const mockCourses: Course[] = [
  {
    id: 'course-1',
    name: 'Introduction to Machine Learning',
    code: 'CS 4820',
    instructorId: 'instructor-1',
    lectureIds: ['lecture-1', 'lecture-2'],
  },
  {
    id: 'course-2',
    name: 'Data Structures & Algorithms',
    code: 'CS 2110',
    instructorId: 'instructor-1',
    lectureIds: ['lecture-3'],
  },
];

export const mockConcepts: Concept[] = [
  // Lecture 1 concepts
  {
    id: 'concept-1',
    name: 'What is Machine Learning?',
    summary: 'Introduction to ML as a field that enables computers to learn from data without explicit programming.',
    startTime: 0,
    endTime: 180,
    lectureId: 'lecture-1',
  },
  {
    id: 'concept-2',
    name: 'Supervised Learning',
    summary: 'Learning paradigm where models learn from labeled training data to make predictions.',
    startTime: 180,
    endTime: 420,
    lectureId: 'lecture-1',
  },
  {
    id: 'concept-3',
    name: 'Gradient Descent',
    summary: 'Optimization algorithm used to minimize loss functions by iteratively moving toward the minimum.',
    startTime: 420,
    endTime: 720,
    lectureId: 'lecture-1',
  },
  {
    id: 'concept-4',
    name: 'Neural Network Basics',
    summary: 'Architecture of interconnected nodes that process information using weighted connections.',
    startTime: 720,
    endTime: 1020,
    lectureId: 'lecture-1',
  },
  {
    id: 'concept-5',
    name: 'Backpropagation',
    summary: 'Algorithm for computing gradients efficiently in neural networks using chain rule.',
    startTime: 1020,
    endTime: 1380,
    lectureId: 'lecture-1',
  },
  // Lecture 2 concepts
  {
    id: 'concept-6',
    name: 'Overfitting & Regularization',
    summary: 'Techniques to prevent models from memorizing training data instead of learning patterns.',
    startTime: 0,
    endTime: 300,
    lectureId: 'lecture-2',
  },
  {
    id: 'concept-7',
    name: 'Cross-Validation',
    summary: 'Method to assess model performance by partitioning data into training and validation sets.',
    startTime: 300,
    endTime: 600,
    lectureId: 'lecture-2',
  },
];

export const mockLectures: Lecture[] = [
  {
    id: 'lecture-1',
    title: 'Introduction to Neural Networks',
    courseId: 'course-1',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 1380,
    concepts: mockConcepts.filter(c => c.lectureId === 'lecture-1'),
    uploadedAt: new Date('2024-01-15'),
  },
  {
    id: 'lecture-2',
    title: 'Model Evaluation Techniques',
    courseId: 'course-1',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    duration: 600,
    concepts: mockConcepts.filter(c => c.lectureId === 'lecture-2'),
    uploadedAt: new Date('2024-01-22'),
  },
];

// Generate mock analytics events
const clusters: BehavioralCluster[] = ['high-replay', 'fast-watcher', 'note-taker', 'late-night-learner', 'steady-pacer'];

export const mockStudents: User[] = Array.from({ length: 45 }, (_, i) => ({
  id: `student-${i + 1}`,
  pseudonymId: generatePseudonymId(),
  role: 'student' as const,
  courseIds: ['course-1'],
  cluster: clusters[Math.floor(Math.random() * clusters.length)],
  createdAt: new Date('2024-01-01'),
}));

// Generate realistic analytics events
export const generateMockEvents = (): AnalyticsEvent[] => {
  const events: AnalyticsEvent[] = [];
  const eventTypes: Array<'play' | 'pause' | 'replay' | 'seek' | 'drop-off' | 'speed-change'> = 
    ['play', 'pause', 'replay', 'seek', 'drop-off', 'speed-change'];

  // Concepts that are "confusing" - will have more replays and drop-offs
  const confusingConcepts = ['concept-3', 'concept-5']; // Gradient Descent & Backpropagation

  mockStudents.forEach(student => {
    mockConcepts.forEach(concept => {
      const isConfusing = confusingConcepts.includes(concept.id);
      const numEvents = isConfusing ? Math.floor(Math.random() * 8) + 5 : Math.floor(Math.random() * 4) + 1;

      for (let i = 0; i < numEvents; i++) {
        const eventType = isConfusing && Math.random() > 0.4 
          ? (Math.random() > 0.5 ? 'replay' : 'drop-off')
          : eventTypes[Math.floor(Math.random() * eventTypes.length)];

        events.push({
          id: `event-${events.length}`,
          userId: student.id,
          courseId: 'course-1',
          lectureId: concept.lectureId,
          conceptId: concept.id,
          eventType,
          timestamp: concept.startTime + Math.random() * (concept.endTime - concept.startTime),
          createdAt: new Date(),
        });
      }
    });
  });

  return events;
};

export const mockEvents = generateMockEvents();

// Calculate concept insights
export const calculateConceptInsights = () => {
  const insights: Record<string, { replays: number; dropOffs: number; totalEvents: number }> = {};

  mockEvents.forEach(event => {
    if (!event.conceptId) return;
    
    if (!insights[event.conceptId]) {
      insights[event.conceptId] = { replays: 0, dropOffs: 0, totalEvents: 0 };
    }

    insights[event.conceptId].totalEvents++;
    if (event.eventType === 'replay') insights[event.conceptId].replays++;
    if (event.eventType === 'drop-off') insights[event.conceptId].dropOffs++;
  });

  return mockConcepts.map(concept => {
    const data = insights[concept.id] || { replays: 0, dropOffs: 0, totalEvents: 0 };
    const struggleScore = (data.replays * 2 + data.dropOffs * 3) / Math.max(data.totalEvents, 1);
    
    return {
      conceptId: concept.id,
      conceptName: concept.name,
      replayCount: data.replays,
      dropOffCount: data.dropOffs,
      avgWatchTime: (concept.endTime - concept.startTime) * 0.85,
      struggleScore: Math.min(struggleScore * 20, 100),
    };
  }).sort((a, b) => b.struggleScore - a.struggleScore);
};

// Calculate cluster insights
export const calculateClusterInsights = () => {
  const clusterData: Record<BehavioralCluster, { students: string[]; conceptStruggles: Record<string, number> }> = {
    'high-replay': { students: [], conceptStruggles: {} },
    'fast-watcher': { students: [], conceptStruggles: {} },
    'note-taker': { students: [], conceptStruggles: {} },
    'late-night-learner': { students: [], conceptStruggles: {} },
    'steady-pacer': { students: [], conceptStruggles: {} },
  };

  mockStudents.forEach(student => {
    if (student.cluster) {
      clusterData[student.cluster].students.push(student.id);
    }
  });

  mockEvents.forEach(event => {
    const student = mockStudents.find(s => s.id === event.userId);
    if (student?.cluster && event.conceptId && (event.eventType === 'replay' || event.eventType === 'drop-off')) {
      if (!clusterData[student.cluster].conceptStruggles[event.conceptId]) {
        clusterData[student.cluster].conceptStruggles[event.conceptId] = 0;
      }
      clusterData[student.cluster].conceptStruggles[event.conceptId]++;
    }
  });

  return Object.entries(clusterData).map(([cluster, data]) => {
    const topStruggles = Object.entries(data.conceptStruggles)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([conceptId]) => mockConcepts.find(c => c.id === conceptId)?.name || conceptId);

    return {
      cluster: cluster as BehavioralCluster,
      studentCount: data.students.length,
      strugglingConcepts: topStruggles,
      avgEngagement: Math.random() * 40 + 60,
    };
  });
};
