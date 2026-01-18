import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { getVideoStreamUrl, incrementSegmentCount } from '@/lib/api';
import { Concept, Lecture, Course, LectureSegment } from '@/types';
import { Play, Pause, SkipForward, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface VideoPlayerProps {
  lecture: Lecture;
  course: Course | null;
}

export interface VideoPlayerRef {
  jumpToConcept: (concept: Concept) => void;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({ lecture, course }, ref) => {
  const { trackEvent, trackRewind } = useAnalytics();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const lastPlayTimeRef = useRef<number>(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [activeConcept, setActiveConcept] = useState<Concept | null>(null);
  const [activeSegment, setActiveSegment] = useState<LectureSegment | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(false);

  // Extract video key from videoUrl (videoUrl format: ${PUBLIC_URL}/${key} or R2 endpoint)
  const extractVideoKey = (videoUrl: string): string | null => {
    if (!videoUrl) return null;
    
    try {
      // Look for 'videos' in the path - this is always present in our video keys
      const videosMatch = videoUrl.match(/\/videos\/.+$/);
      if (videosMatch) {
        // Remove leading slash to get the key
        return videosMatch[0].substring(1);
      }
      
      // If no 'videos' found, try to extract from URL path
      const url = new URL(videoUrl);
      const pathParts = url.pathname.split('/').filter(part => part);
      
      // Look for 'videos' in path parts
      const videosIndex = pathParts.findIndex(part => part === 'videos');
      if (videosIndex !== -1) {
        return pathParts.slice(videosIndex).join('/');
      }
    } catch (error) {
      // If URL parsing fails, try regex approach
      const videosMatch = videoUrl.match(/\/videos\/.+$/);
      if (videosMatch) {
        return videosMatch[0].substring(1);
      }
    }
    
    return null;
  };

  // Fetch presigned stream URL when lecture changes
  useEffect(() => {
    const loadStreamUrl = async () => {
      if (!lecture?.videoUrl) {
        setStreamUrl(null);
        return;
      }

      setIsLoadingStream(true);
      try {
        const videoKey = extractVideoKey(lecture.videoUrl);
        
        if (!videoKey) {
          // Fallback to using the videoUrl directly if we can't extract key
          console.warn('Could not extract video key, using videoUrl directly:', lecture.videoUrl);
          setStreamUrl(lecture.videoUrl);
          setIsLoadingStream(false);
          return;
        }

        const response = await getVideoStreamUrl(videoKey);
        if (response.success && response.streamUrl) {
          setStreamUrl(response.streamUrl);
        } else {
          // Fallback to original videoUrl
          setStreamUrl(lecture.videoUrl);
        }
      } catch (error) {
        console.error('Failed to load stream URL, using videoUrl directly:', error);
        // Fallback to original videoUrl
        setStreamUrl(lecture.videoUrl);
      } finally {
        setIsLoadingStream(false);
      }
    };

    loadStreamUrl();
  }, [lecture?.videoUrl, lecture?.id]);

  // Reset previous time and duration when lecture changes
  useEffect(() => {
    if (lecture) {
      previousTimeRef.current = 0;
      setCurrentTime(0);
      setVideoDuration(0); // Reset duration, will be set when video metadata loads
      setActiveSegment(null); // Reset active segment
    }
  }, [lecture?.id]);

  // Track current concept based on video time
  useEffect(() => {
    if (lecture) {
      const concept = lecture.concepts.find(
        c => currentTime >= c.startTime && currentTime < c.endTime
      );
      if (concept && concept.id !== activeConcept?.id) {
        setActiveConcept(concept);
      }
    }
  }, [currentTime, lecture, activeConcept]);

  // Track current segment based on video time
  useEffect(() => {
    if (lecture && lecture.lectureSegments && lecture.lectureSegments.length > 0) {
      const segment = lecture.lectureSegments.find(
        s => currentTime >= s.start && currentTime < s.end
      );
      if (segment) {
        // Only update if the segment title changed to avoid unnecessary re-renders
        setActiveSegment(prev => {
          if (prev?.title !== segment.title) {
            return segment;
          }
          return prev;
        });
      } else {
        // Only clear if there was an active segment
        setActiveSegment(prev => prev ? null : prev);
      }
    } else {
      setActiveSegment(null);
    }
  }, [currentTime, lecture]);

  // Debug: Log when lecture segments change
  useEffect(() => {
    if (lecture) {
      console.log('[VideoPlayer] Lecture segments:', lecture.lectureSegments?.length || 0, lecture.lectureSegments);
    }
  }, [lecture?.id, lecture?.lectureSegments]);

  const handlePlayPause = async () => {
    if (!videoRef.current || !lecture) return;
    
    try {
      if (isPlaying) {
        videoRef.current.pause();
        // onPause handler will set isPlaying to false
      } else {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          // onPlay handler will set isPlaying to true
        }
      }
    } catch (error) {
      console.error('Error in handlePlayPause:', error);
      // If play fails (e.g., autoplay policy), keep state as paused
      if (!isPlaying) {
        setIsPlaying(false);
      }
    }
  };

  const jumpToConcept = (concept: Concept) => {
    if (videoRef.current && lecture) {
      const previousTime = previousTimeRef.current;
      const newTime = concept.startTime;
      
      // Track rewind if jumping backwards
      if (newTime < previousTime && trackRewind && course) {
        const previousConcept = lecture.concepts.find(
          c => previousTime >= c.startTime && previousTime < c.endTime
        );
        trackRewind(
          lecture.id,
          lecture.title,
          course.id,
          {
            fromTime: previousTime,
            toTime: newTime,
            rewindAmount: previousTime - newTime,
            fromConceptId: previousConcept?.id,
            fromConceptName: previousConcept?.name,
            toConceptId: concept.id,
            toConceptName: concept.name,
          }
        );
      }
      
      videoRef.current.currentTime = newTime;
      previousTimeRef.current = newTime;
      setCurrentTime(newTime);
      trackEvent('concept-jump', lecture.id, concept.id);
      if (!isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Expose jumpToConcept via ref
  useImperativeHandle(ref, () => ({
    jumpToConcept,
  }));

  const handleTimeUpdate = () => {
    if (videoRef.current && lecture) {
      const newTime = videoRef.current.currentTime;
      const previousTime = previousTimeRef.current;
      
      // Detect rewind: current time is less than previous time
      // Only track if there's a meaningful rewind (more than 0.5 seconds to avoid false positives)
      if (previousTime > 0 && newTime < previousTime - 0.5) {
        const rewindAmount = previousTime - newTime;
        
        // Find concepts at both positions
        const previousConcept = lecture.concepts.find(
          c => previousTime >= c.startTime && previousTime < c.endTime
        );
        const newConcept = lecture.concepts.find(
          c => newTime >= c.startTime && newTime < c.endTime
        );
        
        // Track rewind event to MongoDB
        if (trackRewind && course) {
          trackRewind(
            lecture.id,
            lecture.title,
            course.id,
            {
              fromTime: previousTime,
              toTime: newTime,
              rewindAmount: rewindAmount,
              fromConceptId: previousConcept?.id,
              fromConceptName: previousConcept?.name,
              toConceptId: newConcept?.id,
              toConceptName: newConcept?.name,
            }
          );
        }
      }
      
      previousTimeRef.current = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="glass-card overflow-hidden">
      {/* Video */}
      <div className="relative aspect-video bg-secondary">
        {isLoadingStream ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading video...</p>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={streamUrl || lecture.videoUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setVideoDuration(videoRef.current.duration || 0);
              }
            }}
            onPlay={(e) => {
              e.preventDefault();
              isPlayingRef.current = true;
              lastPlayTimeRef.current = Date.now();
              setIsPlaying(true);
              if (lecture) {
                trackEvent('play', lecture.id, activeConcept?.id);
              }
            }}
            onPause={(e) => {
              const now = Date.now();
              const timeSincePlay = now - lastPlayTimeRef.current;
              
              // Ignore pause events that happen within 300ms of play (likely from click propagation)
              if (timeSincePlay < 300 && isPlayingRef.current) {
                // If video got paused, resume it immediately
                if (videoRef.current?.paused) {
                  // Use setTimeout to ensure this happens after the pause event completes
                  setTimeout(() => {
                    if (videoRef.current && isPlayingRef.current) {
                      videoRef.current.play().catch(err => {
                        console.error('Failed to resume after false pause:', err);
                        isPlayingRef.current = false;
                        setIsPlaying(false);
                      });
                    }
                  }, 10);
                  return;
                }
                
                // If video is still playing, just ignore this pause event
                if (videoRef.current && !videoRef.current.paused) {
                  return;
                }
              }
              
              // Only process intentional pauses
              isPlayingRef.current = false;
              setIsPlaying(false);
              if (lecture) {
                trackEvent('pause', lecture.id, activeConcept?.id);
              }
            }}
            onWaiting={() => {
              console.log('Video waiting - buffering');
            }}
            onCanPlay={() => {
              console.log('Video can play - ready to play');
            }}
            onEnded={() => setIsPlaying(false)}
            onError={(e) => {
              console.error('Video error:', e);
              console.error('Video src:', streamUrl || lecture.videoUrl);
              setIsPlaying(false);
            }}
            preload="metadata"
            playsInline
            crossOrigin="anonymous"
          />
        )}
        
        {/* Click overlay to toggle play/pause - always present but invisible when playing */}
        <div 
          className={`absolute inset-0 cursor-pointer z-[5] ${!isPlaying ? 'flex items-center justify-center bg-secondary/50' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePlayPause();
          }}
        >
          {/* Play button - only show when paused */}
          {!isPlaying && (
            <div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center glow pointer-events-none">
              <Play className="w-8 h-8 text-primary-foreground ml-1" />
            </div>
          )}
        </div>

        {/* Current concept overlay */}
        {activeConcept && (
          <motion.div
            key={activeConcept.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-4 right-4 pointer-events-none z-10"
          >
            <div className="glass-card px-4 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{activeConcept.name}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Current segment overlay */}
        {activeSegment && activeSegment.title && (
          <motion.div
            key={activeSegment.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-4 right-4 pointer-events-none z-20"
          >
            <div className="glass-card px-4 py-2 rounded-lg border border-primary/30">
              <div className="flex items-center gap-2">
                <SkipForward className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">{activeSegment.title}</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          
          <div 
            className="flex-1 relative cursor-pointer"
            onClick={async (e) => {
              if (videoRef.current && videoDuration > 0) {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percent = clickX / rect.width;
                const newTime = percent * videoDuration;
                
                if (videoRef.current) {
                  const previousTime = previousTimeRef.current;
                  videoRef.current.currentTime = newTime;
                  previousTimeRef.current = newTime;
                  setCurrentTime(newTime);
                  
                  // Find which segment the seek time falls into and increment its count
                  if (lecture?.lectureSegments && lecture.lectureSegments.length > 0 && course) {
                    const segmentIndex = lecture.lectureSegments.findIndex(
                      seg => newTime >= seg.start && newTime < seg.end
                    );
                    if (segmentIndex !== -1) {
                      try {
                        await incrementSegmentCount(course.id, lecture.id, segmentIndex);
                      } catch (error) {
                        console.error('Failed to increment segment count:', error);
                      }
                    }
                  }
                  
                  // Track rewind if seeking backwards
                  if (newTime < previousTime && trackRewind && course && lecture) {
                    trackRewind(
                      lecture.id,
                      lecture.title,
                      course.id,
                      {
                        fromTime: previousTime,
                        toTime: newTime,
                        rewindAmount: previousTime - newTime,
                        fromConceptId: activeConcept?.id,
                        fromConceptName: activeConcept?.name,
                      }
                    );
                  }
                  
                  trackEvent('seek', lecture.id, undefined, { action: 'progress-bar-seek' });
                }
              }
            }}
          >
            <Progress 
              value={videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0}
              className="h-2"
            />
            {/* Segment markers on progress bar */}
            {lecture.lectureSegments && lecture.lectureSegments.length > 0 && (
              <>
                {/* Vertical divider lines */}
                <div className="absolute top-0 left-0 right-0 h-2 pointer-events-none z-10">
                  {lecture.lectureSegments.map((segment, i) => {
                    const segmentStartPercent = videoDuration > 0 ? (segment.start / videoDuration) * 100 : 0;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-border"
                        style={{ left: `${segmentStartPercent}%` }}
                      />
                    );
                  })}
                </div>
                {/* Hoverable segment areas with tooltips */}
                <div className="absolute top-0 left-0 right-0 h-2 pointer-events-auto z-10">
                  {lecture.lectureSegments.map((segment, i) => {
                    const segmentStartPercent = videoDuration > 0 ? (segment.start / videoDuration) * 100 : 0;
                    const segmentEndPercent = videoDuration > 0 ? (segment.end / videoDuration) * 100 : 0;
                    const segmentWidth = segmentEndPercent - segmentStartPercent;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 group"
                        style={{ 
                          left: `${segmentStartPercent}%`,
                          width: `${segmentWidth}%`
                        }}
                        onClick={async (e) => {
                          // Forward click to progress bar for seeking
                          const progressBarContainer = e.currentTarget.parentElement?.parentElement;
                          if (progressBarContainer && videoRef.current && videoDuration > 0) {
                            const rect = progressBarContainer.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const percent = clickX / rect.width;
                            const newTime = percent * videoDuration;
                            
                            videoRef.current.currentTime = newTime;
                            previousTimeRef.current = newTime;
                            setCurrentTime(newTime);
                            
                            // Find which segment the seek time falls into and increment its count
                            if (lecture?.lectureSegments && lecture.lectureSegments.length > 0 && course) {
                              const segmentIndex = lecture.lectureSegments.findIndex(
                                seg => newTime >= seg.start && newTime < seg.end
                              );
                              if (segmentIndex !== -1) {
                                try {
                                  await incrementSegmentCount(course.id, lecture.id, segmentIndex);
                                } catch (error) {
                                  console.error('Failed to increment segment count:', error);
                                }
                              }
                            }
                            
                            trackEvent('seek', lecture.id, undefined, { action: 'segment-seek' });
                          }
                        }}
                      >
                        {/* Tooltip label */}
                        <div className="absolute top-full left-0 mt-2 hidden group-hover:block z-20 pointer-events-none">
                          <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap border border-border">
                            {segment.title}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          
          <span className="text-sm font-mono text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(videoDuration)}
          </span>
        </div>

        {/* Concept timeline */}
        <div className="flex gap-1 h-2">
          {lecture.concepts.map((concept, i) => (
            <div
              key={concept.id}
              className={`rounded-full cursor-pointer transition-all ${
                activeConcept?.id === concept.id 
                  ? 'bg-primary glow' 
                  : 'bg-muted hover:bg-muted-foreground/30'
              }`}
              style={{ 
                flex: videoDuration > 0 ? (concept.endTime - concept.startTime) / videoDuration : 0
              }}
              onClick={() => jumpToConcept(concept)}
              title={concept.name}
            />
          ))}
        </div>
      </div>
    </Card>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
