export type UserRole = 'student' | 'instructor';

export type BehavioralCluster = 'high-replay' | 'fast-watcher' | 'note-taker' | 'late-night-learner' | 'steady-pacer';

export interface User {
  id: string;
  pseudonymId: string;
  role: UserRole;
  courseIds: string[];
  cluster?: BehavioralCluster;
  createdAt: Date;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  instructorId: string;
  lectureIds: string[];
}

export interface Concept {
  id: string;
  name: string;
  summary: string;
  startTime: number;
  endTime: number;
  lectureId: string;
}

export interface Lecture {
  id: string;
  title: string;
  courseId: string;
  videoUrl: string;
  duration: number;
  concepts: Concept[];
  uploadedAt: Date;
}

export type EventType = 'play' | 'pause' | 'replay' | 'seek' | 'drop-off' | 'speed-change' | 'concept-jump';

export interface AnalyticsEvent {
  id: string;
  userId: string;
  courseId: string;
  lectureId: string;
  conceptId?: string;
  eventType: EventType;
  timestamp: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ConceptInsight {
  conceptId: string;
  conceptName: string;
  replayCount: number;
  dropOffCount: number;
  avgWatchTime: number;
  struggleScore: number;
}

export interface ClusterInsight {
  cluster: BehavioralCluster;
  studentCount: number;
  strugglingConcepts: string[];
  avgEngagement: number;
}
