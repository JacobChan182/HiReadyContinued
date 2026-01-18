import React, { createContext, useContext, useCallback, useState } from 'react';
import { AnalyticsEvent, EventType } from '@/types';
import { useAuth } from './AuthContext';
import { trackRewindEvent } from '@/lib/api';

interface AnalyticsContextType {
  trackEvent: (eventType: EventType, lectureId: string, conceptId?: string, metadata?: Record<string, unknown>) => void;
  trackRewind: (lectureId: string, lectureTitle: string, courseId: string, rewindData: {
    fromTime: number;
    toTime: number;
    rewindAmount: number;
    fromConceptId?: string;
    fromConceptName?: string;
    toConceptId?: string;
    toConceptName?: string;
    segmentIndex?: number;
    segmentTitle?: string;
  }) => void;
  events: AnalyticsEvent[];
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);

  const trackRewind = useCallback(async (
    lectureId: string,
    lectureTitle: string,
    courseId: string,
    rewindData: {
      fromTime: number;
      toTime: number;
      rewindAmount: number;
      fromConceptId?: string;
      fromConceptName?: string;
      toConceptId?: string;
      toConceptName?: string;
      segmentIndex?: number;
      segmentTitle?: string;
    }
  ) => {
    if (!user) return;

    const rewindEvent = {
      id: `rewind-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fromTime: rewindData.fromTime,
      toTime: rewindData.toTime,
      rewindAmount: rewindData.rewindAmount,
      fromConceptId: rewindData.fromConceptId,
      fromConceptName: rewindData.fromConceptName,
      toConceptId: rewindData.toConceptId,
      toConceptName: rewindData.toConceptName,
      segmentIndex: rewindData.segmentIndex,
      segmentTitle: rewindData.segmentTitle,
      timestamp: Date.now(),
      createdAt: new Date(),
    };

    try {
      // Store in MongoDB Atlas
      await trackRewindEvent(
        user.id,
        user.pseudonymId,
        lectureId,
        lectureTitle,
        courseId,
        rewindEvent
      );
      
      // Also add to local state for immediate UI updates
      const event: AnalyticsEvent = {
        id: rewindEvent.id,
        userId: user.id,
        courseId,
        lectureId,
        conceptId: rewindData.toConceptId,
        eventType: 'rewind' as EventType,
        timestamp: rewindEvent.timestamp,
        metadata: {
          fromTime: rewindData.fromTime,
          toTime: rewindData.toTime,
          rewindAmount: rewindData.rewindAmount,
          fromConceptId: rewindData.fromConceptId,
          fromConceptName: rewindData.fromConceptName,
          toConceptId: rewindData.toConceptId,
          toConceptName: rewindData.toConceptName,
          segmentIndex: rewindData.segmentIndex,
          segmentTitle: rewindData.segmentTitle,
        },
        createdAt: rewindEvent.createdAt,
      };
      
      setEvents(prev => [...prev, event]);
    } catch (error) {
      console.error('Failed to track rewind event to MongoDB:', error);
      // Still add to local state even if API call fails
      const event: AnalyticsEvent = {
        id: rewindEvent.id,
        userId: user.id,
        courseId,
        lectureId,
        conceptId: rewindData.toConceptId,
        eventType: 'rewind' as EventType,
        timestamp: rewindEvent.timestamp,
        metadata: {
          fromTime: rewindData.fromTime,
          toTime: rewindData.toTime,
          rewindAmount: rewindData.rewindAmount,
          segmentIndex: rewindData.segmentIndex,
          segmentTitle: rewindData.segmentTitle,
        },
        createdAt: rewindEvent.createdAt,
      };
      setEvents(prev => [...prev, event]);
    }
  }, [user]);

  const trackEvent = useCallback((
    eventType: EventType,
    lectureId: string,
    conceptId?: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!user) return;

    const event: AnalyticsEvent = {
      id: `event-${Date.now()}`,
      userId: user.id,
      courseId: user.courseIds[0],
      lectureId,
      conceptId,
      eventType,
      timestamp: Date.now(),
      metadata,
      createdAt: new Date(),
    };

    setEvents(prev => [...prev, event]);
    
    // Log other events (not rewind - those are handled by trackRewind)
    if (eventType !== 'rewind') {
      console.log('[HiReady.tech Analytics]', {
        event: eventType,
        user: user.pseudonymId,
        lecture: lectureId,
        concept: conceptId,
        ...metadata,
      });
    }
  }, [user]);

  return (
    <AnalyticsContext.Provider value={{ trackEvent, trackRewind, events }}>
      {children}
    </AnalyticsContext.Provider>
  );
};

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return context;
}
