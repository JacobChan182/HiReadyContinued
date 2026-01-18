import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { mockLectures, mockCourses, enrichLecturesWithMockData } from '@/data/mockData';
import { getStudentCourses } from '@/lib/api';
import { Concept, Lecture, Course } from '@/types';
import { 
  Search, Sparkles, Clock, 
  BookOpen, ChevronRight, Zap, LogOut, User, ChevronDown, TrendingUp, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import VideoPlayer, { VideoPlayerRef } from '@/components/VideoPlayer';
import ChatWidget from '@/components/ChatWidget';
import { useToast } from '@/hooks/use-toast';
import QuizDisplay from '@/components/QuizDisplay';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string | number;
  explanation?: string;
}

type QuizContent = string | { questions: QuizQuestion[] };

interface LectureWithMeta extends Lecture {
  lectureId?: string;
  lectureTitle?: string;
  _id?: string;
}

const getLectureId = (lecture: LectureWithMeta): string | undefined =>
  lecture.lectureId ?? lecture.id ?? lecture._id;

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [lectures, setLectures] = useState<LectureWithMeta[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLecture, setSelectedLecture] = useState<LectureWithMeta | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoPlayerRef = useRef<VideoPlayerRef | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<QuizContent | null>(null);

  // TODO: Replace with actual assessment/quiz scores from your teammate's implementation
  // Placeholder worker personality scores (0-100 for each type)
  const [workerPersonality] = useState({
    achieverDreamer: 75,      // Replace with actual quiz score
    helperMediator: 60,       // Replace with actual quiz score
    analystInvestigator: 85,  // Replace with actual quiz score
    championPersuader: 45,    // Replace with actual quiz score
    individualist: 55,        // Replace with actual quiz score
    problemSolverDetective: 70, // Replace with actual quiz score
    challengerDebater: 50,    // Replace with actual quiz score
  });

  // Calculate percentages for pie chart
  const workerTypes = [
    { name: 'Achiever/Dreamer', score: workerPersonality.achieverDreamer, color: '#3b82f6' },
    { name: 'Helper/Mediator', score: workerPersonality.helperMediator, color: '#10b981' },
    { name: 'Analyst/Investigator', score: workerPersonality.analystInvestigator, color: '#8b5cf6' },
    { name: 'Champion/Persuader', score: workerPersonality.championPersuader, color: '#f59e0b' },
    { name: 'Individualist', score: workerPersonality.individualist, color: '#ec4899' },
    { name: 'Problem Solver/Detective', score: workerPersonality.problemSolverDetective, color: '#06b6d4' },
    { name: 'Challenger/Debater', score: workerPersonality.challengerDebater, color: '#ef4444' },
  ];

  const totalScore = workerTypes.reduce((sum, type) => sum + type.score, 0);
  const workerTypesWithPercentages = workerTypes.map(type => ({
    ...type,
    percentage: totalScore > 0 ? (type.score / totalScore) * 100 : 0,
  }));

  // Get dominant worker type
  const dominantType = workerTypesWithPercentages.reduce((prev, current) => 
    current.percentage > prev.percentage ? current : prev
  );

  // Generate pie chart paths
  const generatePieChart = () => {
    let cumulativePercentage = 0;
    return workerTypesWithPercentages.map((type) => {
      const startAngle = (cumulativePercentage / 100) * 360;
      cumulativePercentage += type.percentage;
      const endAngle = (cumulativePercentage / 100) * 360;
      
      const startRad = (startAngle - 90) * (Math.PI / 180);
      const endRad = (endAngle - 90) * (Math.PI / 180);
      
      const x1 = 50 + 45 * Math.cos(startRad);
      const y1 = 50 + 45 * Math.sin(startRad);
      const x2 = 50 + 45 * Math.cos(endRad);
      const y2 = 50 + 45 * Math.sin(endRad);
      
      const largeArc = type.percentage > 50 ? 1 : 0;
      
      return {
        ...type,
        path: `M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArc} 1 ${x2} ${y2} Z`,
      };
    });
  };

  const pieChartData = generatePieChart();

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
          const safeApiLectures = Array.isArray(apiLectures) ? (apiLectures as LectureWithMeta[]) : [];
          
          console.log('📥 Raw API lectures:', safeApiLectures);
          
          // 1. Map and preserve ALL fields from API including segments
          const formattedLectures: LectureWithMeta[] = safeApiLectures.map((lec) => {
            const formatted = {
              ...lec, // Preserve everything from API first
              id: lec.lectureId,
              lectureId: lec.lectureId,
              title: lec.lectureTitle || lec.title,
              lectureTitle: lec.lectureTitle || lec.title,
              lectureSegments: Array.isArray(lec.lectureSegments) ? lec.lectureSegments : [],
            };
            console.log(`📝 Formatted lecture ${formatted.id}:`, {
              title: formatted.title,
              segmentCount: formatted.lectureSegments.length,
              segments: formatted.lectureSegments
            });
            return formatted;
          });
          
          console.log('✅ Formatted lectures with segments:', formattedLectures.map((l) => ({
            id: l.id,
            title: l.title,
            segmentCount: l.lectureSegments?.length || 0
          })));

          // 2. Enrich with mock concepts ONLY (don't let enrichment touch segments)
          const enriched = enrichLecturesWithMockData(formattedLectures) as LectureWithMeta[];
          
          console.log('🔧 After enrichment:', enriched.map((l) => ({
            id: l.id,
            title: l.title,
            segmentCount: l.lectureSegments?.length || 0,
            conceptCount: l.concepts?.length || 0
          })));
          
          // 3. Merge: FORCE preserve segments and other real data from formatted
          const finalLectures: LectureWithMeta[] = enriched.map((enrichedLec) => {
            const original = formattedLectures.find((o) => o.id === enrichedLec.id);
            if (!original) {
              console.warn(`⚠️ No original found for enriched lecture ${enrichedLec.id}`);
              return enrichedLec;
            }
            
            const merged = {
              ...enrichedLec, // Start with enriched (has mock concepts)
              // FORCE overwrite with real API data
              lectureSegments: original.lectureSegments, // Always use original segments
              videoUrl: original.videoUrl,
              uploadedAt: original.uploadedAt,
              lectureId: original.lectureId,
              // Only use enriched concepts if original has none
              concepts: (original.concepts && original.concepts.length > 0) 
                ? original.concepts 
                : enrichedLec.concepts,
            };
            
            console.log(`🔀 Merged lecture ${merged.id}:`, {
              title: merged.title,
              segmentCount: merged.lectureSegments?.length || 0,
              conceptCount: merged.concepts?.length || 0,
              segments: merged.lectureSegments
            });
            
            return merged;
          });

          console.log('🎯 Final lectures after merge:', finalLectures.map((l) => ({
            id: l.id,
            title: l.title,
            segmentCount: l.lectureSegments?.length || 0,
            conceptCount: l.concepts?.length || 0
          })));

          const finalCourses = (apiCourses && apiCourses.length > 0) ? apiCourses : mockCourses;

          setCourses(finalCourses);
          setLectures(finalLectures.length > 0 ? finalLectures : mockLectures);

          // Set initial course and lecture selection
          if (finalCourses.length > 0) {
            const firstCourseId = finalCourses[0].id;
            setSelectedCourseId(firstCourseId);
            
            const firstCourseLectures = finalLectures.filter(l => l.courseId === firstCourseId);
            if (firstCourseLectures.length > 0) {
              // Prefer lectures with segments for initial selection
              const lectureWithSegments = firstCourseLectures.find(
                l => Array.isArray(l.lectureSegments) && l.lectureSegments.length > 0
              );
              const initialLecture = lectureWithSegments || firstCourseLectures[0];
              
              console.log('🎬 Setting initial lecture:', {
                id: initialLecture.id,
                title: initialLecture.title,
                segmentCount: initialLecture.lectureSegments?.length || 0,
                hasSegments: Array.isArray(initialLecture.lectureSegments) && initialLecture.lectureSegments.length > 0
              });
              setSelectedLecture(initialLecture);
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
        console.error('Failed to fetch training courses, using mock data:', error);
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
  const filteredConcepts = selectedLecture
    ? selectedLecture.concepts.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.summary.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const jumpToConcept = (concept: Concept) => {
    // Delegate to VideoPlayer component
    if (videoPlayerRef.current) {
      videoPlayerRef.current.jumpToConcept(concept);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateSummary = () => {
    if (selectedLecture) {
      setShowSummary(true);
    }
  };

  const generateQuiz = async () => {
    if (!selectedLecture) return;

    // Try multiple possible ID fields
    const lectureId = getLectureId(selectedLecture);
    
    const videoTitle = selectedLecture.lectureTitle || selectedLecture.title;
    
    console.log("🚀 PAYLOAD CHECK:", {
      lectureId: lectureId,
      selectedLecture_lectureId: selectedLecture.lectureId,
      selectedLecture_id: selectedLecture.id,
      selectedLecture_mongoId: selectedLecture._id,
      url: selectedLecture.videoUrl,
      title: videoTitle,
      allKeys: Object.keys(selectedLecture) // See all available keys
    });

    if (!lectureId) {
      console.error("❌ No valid lecture ID found. Full lecture object:", selectedLecture);
      toast({
        title: 'Error',
        description: 'Lecture ID is missing. Cannot generate quiz. Check console for details.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingQuiz(true);
    try {
      const response = await fetch('http://localhost:5001/api/backboard/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lecture_id: lectureId,
          video_id: selectedLecture.videoUrl,
          video_title: videoTitle,
          content_type: 'quiz'
        }),
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        console.log("Quiz Generated:", data.content);
        setGeneratedQuiz(data.content);
        toast({
          title: 'Success',
          description: 'Quiz generated successfully!',
        });
      } else {
        console.error("Error:", data.message);
        toast({
          title: 'Error',
          description: data.message || 'Failed to generate quiz',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error("Network Error:", error);
      toast({
        title: 'Error',
        description: 'Failed to connect to quiz generation service',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingQuiz(false);
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
          <>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Video Player Section */}
            <div className="lg:col-span-2 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <VideoPlayer ref={videoPlayerRef} lecture={selectedLecture} course={course} />
              </motion.div>

              {/* Lecture Info */}
              <Card className="glass-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-semibold">{selectedLecture.title}</h1>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button 
                      onClick={generateQuiz} 
                      variant="outline"
                      disabled={isGeneratingQuiz}
                      className="whitespace-nowrap"
                    >
                      {isGeneratingQuiz ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <ClipboardList className="w-4 h-4 mr-2" />
                          Generate Quiz
                        </>
                      )}
                    </Button>
                  </div>
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

              {/* Generated Quiz Display - UPDATED */}
              {generatedQuiz && (
                <QuizDisplay 
                  quizContent={generatedQuiz} 
                  onClose={() => setGeneratedQuiz(null)} 
                />
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Worker Personality Section */}
              <Card className="glass-card p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  What Kind of Worker Are You?
                </h3>
                
                {/* Pie Chart */}
                <div className="flex items-center justify-center mb-4">
                  <svg viewBox="0 0 100 100" className="w-48 h-48">
                    {pieChartData.map((slice, index) => (
                      <motion.path
                        key={slice.name}
                        d={slice.path}
                        fill={slice.color}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    ))}
                  </svg>
                </div>

                {/* Dominant Type */}
                <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: `${dominantType.color}15` }}>
                  <p className="text-xs text-muted-foreground mb-1">Your Dominant Type</p>
                  <p className="font-semibold" style={{ color: dominantType.color }}>
                    {dominantType.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {dominantType.percentage.toFixed(1)}% of your profile
                  </p>
                </div>

                {/* Legend */}
                <div className="space-y-2">
                  {workerTypesWithPercentages
                    .sort((a, b) => b.percentage - a.percentage)
                    .map((type) => (
                      <div key={type.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: type.color }}
                          />
                          <span className="text-muted-foreground">{type.name}</span>
                        </div>
                        <span className="font-mono font-medium">{type.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                </div>

                <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
                  Based on your assessment results. Complete more quizzes to refine your profile.
                </p>
              </Card>

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
                      className="p-3 rounded-lg cursor-pointer transition-all bg-muted/50 hover:bg-muted"
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
          <ChatWidget lectureId={selectedLecture?.id} videoTitle={selectedLecture?.title} />
          </>
        )}
          </>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard;
