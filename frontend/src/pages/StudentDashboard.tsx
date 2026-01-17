import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { mockLectures, mockCourses, enrichLecturesWithMockData } from '@/data/mockData';
import { getStudentCourses, getVideoStreamUrl } from '@/lib/api';
import { Concept, Lecture, Course } from '@/types';
import { 
  Play, Pause, SkipForward, Search, Sparkles, Clock, 
  BookOpen, ChevronRight, Zap, LogOut, User, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const { trackEvent, trackRewind } = useAnalytics();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousTimeRef = useRef<number>(0);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [activeConcept, setActiveConcept] = useState<Concept | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(false);

  // Fetch student courses and lectures from API
  useEffect(() => {
    const fetchStudentData = async () => {
      if (!user || user.role !== 'student') {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await getStudentCourses(user.id);

        if (response.success && response.data) {
          const { courses: apiCourses, lectures: apiLectures } = response.data;

          // Transform and enrich lectures with mock data (for concepts, duration, etc.)
          const enrichedLectures = enrichLecturesWithMockData(apiLectures || []);

          // Determine which courses and lectures to use
          const finalCourses = (apiCourses && apiCourses.length > 0) ? apiCourses : mockCourses;
          const finalLectures = (enrichedLectures.length > 0) ? enrichedLectures : mockLectures;

          setCourses(finalCourses);
          setLectures(finalLectures);

          // Set initial course selection
          if (finalCourses.length > 0) {
            const firstCourseId = finalCourses[0].id;
            setSelectedCourseId(firstCourseId);
            
            // Set initial lecture selection for the first course
            const firstCourseLectures = finalLectures.filter(l => l.courseId === firstCourseId);
            if (firstCourseLectures.length > 0) {
              setSelectedLecture(firstCourseLectures[0]);
            } else if (finalLectures.length > 0) {
              setSelectedLecture(finalLectures[0]);
            }
          }
        } else {
          // Fallback to mock data
          setCourses(mockCourses);
          setLectures(mockLectures);
          if (mockCourses.length > 0) {
            setSelectedCourseId(mockCourses[0].id);
            const firstCourseLectures = mockLectures.filter(l => l.courseId === mockCourses[0].id);
            if (firstCourseLectures.length > 0) {
              setSelectedLecture(firstCourseLectures[0]);
            } else if (mockLectures.length > 0) {
              setSelectedLecture(mockLectures[0]);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch student courses, using mock data:', error);
        // Fallback to mock data
        setCourses(mockCourses);
        setLectures(mockLectures);
        if (mockCourses.length > 0 && !selectedCourseId) {
          setSelectedCourseId(mockCourses[0].id);
        }
        if (mockLectures.length > 0 && !selectedLecture) {
          setSelectedLecture(mockLectures[0]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Get user's assigned courses
  const userCourses = courses;

  // Get selected course
  const course = selectedCourseId
    ? courses.find(c => c.id === selectedCourseId)
    : userCourses.length > 0
      ? userCourses[0]
      : selectedLecture
        ? courses.find(c => c.id === selectedLecture.courseId)
        : null;

  // Filter lectures by selected course
  const availableLectures = course
    ? lectures.filter(l => l.courseId === course.id)
    : lectures;

  // Update selected lecture when course changes
  useEffect(() => {
    if (course && availableLectures.length > 0) {
      // Check if current lecture belongs to selected course
      const currentLectureInCourse = selectedLecture 
        ? availableLectures.find(l => l.id === selectedLecture.id)
        : null;
      if (!currentLectureInCourse) {
        // Current lecture doesn't belong to selected course, switch to first lecture in course
        setSelectedLecture(availableLectures[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]);

  // Update selected lecture when course changes
  useEffect(() => {
    if (course && availableLectures.length > 0) {
      // Check if current lecture belongs to selected course
      const currentLectureInCourse = selectedLecture 
        ? availableLectures.find(l => l.id === selectedLecture.id)
        : null;
      if (!currentLectureInCourse) {
        // Current lecture doesn't belong to selected course, switch to first lecture in course
        setSelectedLecture(availableLectures[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]);

  const handleSwitchCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    const newCourse = courses.find(c => c.id === courseId);
    if (newCourse) {
      const firstLecture = lectures.find(l => l.courseId === courseId);
      if (firstLecture) {
        setSelectedLecture(firstLecture);
      }
    }
  };

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
      // This handles edge cases where the URL structure might differ
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
      if (!selectedLecture?.videoUrl) {
        setStreamUrl(null);
        return;
      }

      setIsLoadingStream(true);
      try {
        const videoKey = extractVideoKey(selectedLecture.videoUrl);
        
        if (!videoKey) {
          // Fallback to using the videoUrl directly if we can't extract key
          console.warn('Could not extract video key, using videoUrl directly:', selectedLecture.videoUrl);
          setStreamUrl(selectedLecture.videoUrl);
          setIsLoadingStream(false);
          return;
        }

        const response = await getVideoStreamUrl(videoKey);
        if (response.success && response.streamUrl) {
          setStreamUrl(response.streamUrl);
        } else {
          // Fallback to original videoUrl
          setStreamUrl(selectedLecture.videoUrl);
        }
      } catch (error) {
        console.error('Failed to load stream URL, using videoUrl directly:', error);
        // Fallback to original videoUrl
        setStreamUrl(selectedLecture.videoUrl);
      } finally {
        setIsLoadingStream(false);
      }
    };

    loadStreamUrl();
  }, [selectedLecture?.videoUrl, selectedLecture?.id]);

  // Reset previous time and duration when lecture changes
  useEffect(() => {
    if (selectedLecture) {
      previousTimeRef.current = 0;
      setCurrentTime(0);
      setVideoDuration(0); // Reset duration, will be set when video metadata loads
    }
  }, [selectedLecture?.id]);

  // Track current concept based on video time
  useEffect(() => {
    if (selectedLecture) {
      const concept = selectedLecture.concepts.find(
        c => currentTime >= c.startTime && currentTime < c.endTime
      );
      if (concept && concept.id !== activeConcept?.id) {
        setActiveConcept(concept);
      }
    }
  }, [currentTime, selectedLecture, activeConcept]);

  const handlePlayPause = () => {
    if (videoRef.current && selectedLecture) {
      if (isPlaying) {
        videoRef.current.pause();
        trackEvent('pause', selectedLecture.id, activeConcept?.id);
      } else {
        videoRef.current.play();
        trackEvent('play', selectedLecture.id, activeConcept?.id);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const jumpToConcept = (concept: Concept) => {
    if (videoRef.current && selectedLecture) {
      const previousTime = previousTimeRef.current;
      const newTime = concept.startTime;
      
      // Track rewind if jumping backwards
      if (newTime < previousTime && trackRewind && course) {
        const previousConcept = selectedLecture.concepts.find(
          c => previousTime >= c.startTime && previousTime < c.endTime
        );
        trackRewind(
          selectedLecture.id,
          selectedLecture.title,
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
      trackEvent('concept-jump', selectedLecture.id, concept.id);
      if (!isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && selectedLecture) {
      const newTime = videoRef.current.currentTime;
      const previousTime = previousTimeRef.current;
      
      // Detect rewind: current time is less than previous time
      // Only track if there's a meaningful rewind (more than 0.5 seconds to avoid false positives)
      if (previousTime > 0 && newTime < previousTime - 0.5) {
        const rewindAmount = previousTime - newTime;
        
        // Find concepts at both positions
        const previousConcept = selectedLecture.concepts.find(
          c => previousTime >= c.startTime && previousTime < c.endTime
        );
        const newConcept = selectedLecture.concepts.find(
          c => newTime >= c.startTime && newTime < c.endTime
        );
        
        // Track rewind event to MongoDB
        if (trackRewind && course) {
          trackRewind(
            selectedLecture.id,
            selectedLecture.title,
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

  const filteredConcepts = selectedLecture
    ? selectedLecture.concepts.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.summary.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateSummary = () => {
    if (selectedLecture) {
      setShowSummary(true);
      trackEvent('seek', selectedLecture.id, undefined, { action: 'generate-summary' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Edu<span className="gradient-text">Pulse</span></span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-mono text-muted-foreground">{user?.pseudonymId}</span>
              <Badge variant="secondary" className="text-xs">{user?.cluster}</Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading courses...</p>
            </div>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses assigned</h3>
              <p className="text-muted-foreground">You haven't been assigned to any courses yet.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Course Header */}
            {course && userCourses.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                        <div className="text-left">
                          <p className="text-sm text-muted-foreground">{course.code}</p>
                          <h2 className="text-2xl font-bold">{course.name}</h2>
                        </div>
                        <ChevronDown className="w-4 h-4 ml-2 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      {userCourses.map((c) => (
                        <DropdownMenuItem
                          key={c.id}
                          onClick={() => handleSwitchCourse(c.id)}
                          className={c.id === course.id ? 'bg-primary/10' : ''}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{c.code}</span>
                            <span className="text-xs text-muted-foreground">{c.name}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Badge variant="outline">
                  {availableLectures.length} lecture{availableLectures.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Course Header - Single Course or No Switcher */}
        {course && userCourses.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{course.code}</p>
                  <h2 className="text-2xl font-bold">{course.name}</h2>
                </div>
                <Badge variant="outline">
                  {availableLectures.length} lecture{availableLectures.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </Card>
          </motion.div>
        )}

        {!selectedLecture ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No lectures available</p>
            <p className="text-sm text-muted-foreground">
              {course 
                ? "This course doesn't have any lectures yet."
                : "You haven't been assigned to any courses yet."}
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Video Player Section */}
            <div className="lg:col-span-2 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
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
                        src={streamUrl || selectedLecture.videoUrl}
                        className="w-full h-full object-contain"
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={() => {
                          if (videoRef.current) {
                            setVideoDuration(videoRef.current.duration || 0);
                          }
                        }}
                        onEnded={() => setIsPlaying(false)}
                        preload="metadata"
                        playsInline
                        crossOrigin="anonymous"
                      />
                    )}
                  
                  {/* Play overlay */}
                  {!isPlaying && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-secondary/50 cursor-pointer"
                      onClick={handlePlayPause}
                    >
                      <div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center glow">
                        <Play className="w-8 h-8 text-primary-foreground ml-1" />
                      </div>
                    </div>
                  )}

                  {/* Current concept overlay */}
                  {activeConcept && (
                    <motion.div
                      key={activeConcept.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-4 left-4 right-4"
                    >
                      <div className="glass-card px-4 py-2 rounded-lg">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">{activeConcept.name}</span>
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
                    
                    <div className="flex-1">
                      <Progress 
                        value={videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                    
                    <span className="text-sm font-mono text-muted-foreground">
                      {formatTime(currentTime)} / {formatTime(videoDuration)}
                    </span>
                  </div>

                  {/* Concept timeline */}
                  <div className="flex gap-1 h-2">
                    {selectedLecture.concepts.map((concept, i) => (
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
            </motion.div>

            {/* Lecture Info */}
            <Card className="glass-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-semibold">{selectedLecture.title}</h1>
                </div>
                <Button onClick={generateSummary} className="gradient-bg glow">
                  <Sparkles className="w-4 h-4 mr-2" />
                  2-Min Catch-Up
                </Button>
              </div>
            </Card>

            {/* AI Summary Modal */}
            {showSummary && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="glass-card p-6 border-primary/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">AI-Generated Summary</h3>
                    <Badge variant="outline" className="ml-auto">
                      <Clock className="w-3 h-3 mr-1" />
                      2 min read
                    </Badge>
                  </div>
                  <div className="space-y-3 text-muted-foreground">
                    <p>This lecture covers the fundamentals of neural networks and machine learning optimization:</p>
                    <ul className="space-y-2">
                      {selectedLecture.concepts.map(concept => (
                        <li key={concept.id} className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <span><strong className="text-foreground">{concept.name}:</strong> {concept.summary}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="mt-4"
                    onClick={() => setShowSummary(false)}
                  >
                    Close Summary
                  </Button>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Concept Search */}
            <Card className="glass-card p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search concepts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </Card>

            {/* Concept List */}
            <Card className="glass-card p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Lecture Concepts
              </h3>
              <div className="space-y-2">
                {filteredConcepts.map((concept, i) => (
                  <motion.div
                    key={concept.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => jumpToConcept(concept)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      activeConcept?.id === concept.id
                        ? 'bg-primary/10 border border-primary/30'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{concept.name}</span>
                      <Badge variant="outline" className="text-xs font-mono">
                        {formatTime(concept.startTime)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {concept.summary}
                    </p>
                  </motion.div>
                ))}
              </div>
            </Card>

            {/* Other Lectures */}
            <Card className="glass-card p-4">
              <h3 className="font-semibold mb-3">Other Lectures</h3>
              <div className="space-y-2">
                {availableLectures.filter(l => selectedLecture && l.id !== selectedLecture.id).map(lecture => (
                  <div
                    key={lecture.id}
                    onClick={() => setSelectedLecture(lecture)}
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                  >
                    <p className="font-medium text-sm">{lecture.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {lecture.concepts.length} concepts{lecture.videoUrl && ' • Video'}
                    </p>
                  </div>
                ))}
                {availableLectures.filter(l => selectedLecture && l.id !== selectedLecture.id).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No other lectures in this course
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
        )}
          </>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard;
