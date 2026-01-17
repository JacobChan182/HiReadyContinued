import React, { createContext, useContext, useCallback, useState } from 'react';
import { AnalyticsEvent, EventType } from '@/types';
import { useAuth } from './AuthContext';

interface AnalyticsContextType {
  trackEvent: (eventType: EventType, lectureId: string, conceptId?: string, metadata?: Record<string, unknown>) => void;
  events: AnalyticsEvent[];
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);

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
    
    // Simulate sending to Amplitude
    console.log('[EduPulse Analytics]', {
      event: eventType,
      user: user.pseudonymId,
      lecture: lectureId,
      concept: conceptId,
      ...metadata,
    });
  }, [user]);

  return (
    <AnalyticsContext.Provider value={{ trackEvent, events }}>
      {children}
    </AnalyticsContext.Provider>
  );
};

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return context;
};
