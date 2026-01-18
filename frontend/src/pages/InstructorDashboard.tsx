import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { mockLectures, mockCourses, calculateConceptInsights, calculateClusterInsights, mockStudents, transformInstructorLectures, enrichLecturesWithMockData } from '@/data/mockData';
import { getInstructorLectures, createCourse, updateCourse, getCourseStudents, addStudentsToCourse, removeStudentFromCourse, getLectureWatchProgress } from '@/lib/api';
import { Lecture } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Zap, LogOut, Users, TrendingUp, AlertTriangle, BookOpen, 
  BarChart2, PieChart as PieIcon, Activity, Shield, Eye, Plus, ArrowRight, Settings, X, Save, ChevronDown, ChevronRight, UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import UploadVideo from '@/components/UploadVideo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ChatWidget from '@/components/ChatWidget';

const CHART_COLORS = [
  'hsl(173, 80%, 40%)',
  'hsl(262, 83%, 58%)',
  'hsl(45, 93%, 58%)',
  'hsl(0, 84%, 60%)',
  'hsl(215, 25%, 50%)',
];

type ApiCourseLectureRef = {
  lectureId: string;
};

type ApiInstructorCourse = {
  courseId: string;
  courseName?: string;
  instructorId?: string;
  lectures?: ApiCourseLectureRef[];
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
};

const InstructorDashboard = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [lectures, setLectures] = useState<Lecture[]>(mockLectures);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
  const [courseDialogTab, setCourseDialogTab] = useState<'switch' | 'create'>('switch');
  const [isCourseActionDialogOpen, setIsCourseActionDialogOpen] = useState(false);
  const [clickedCourseId, setClickedCourseId] = useState<string | null>(null);
  const [isCourseSettingsOpen, setIsCourseSettingsOpen] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [studentEmails, setStudentEmails] = useState('');
  const [courses, setCourses] = useState(mockCourses);
  const [isLoadingLectures, setIsLoadingLectures] = useState(true);
  
  // Course settings state
  const [courseSettingsName, setCourseSettingsName] = useState('');
  const [courseSettingsCode, setCourseSettingsCode] = useState('');
  const [courseStudents, setCourseStudents] = useState<Array<{ userId: string; email: string; pseudonymId: string }>>([]);
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [watchProgressData, setWatchProgressData] = useState<{
    retentionData?: Array<{ time: number; viewers: number; retention: number }>;
    totalStudents?: number;
  } | null>(null);
  const [isLoadingWatchProgress, setIsLoadingWatchProgress] = useState(false);

  // TODO: Replace with actual worker personality data from assessments/quizzes
  // Mock data for employee worker personality distribution
  const employeeWorkerTypes = [
    { name: 'Achiever/Dreamer', count: 18, color: '#3b82f6', avgEngagement: 85 },
    { name: 'Helper/Mediator', count: 12, color: '#10b981', avgEngagement: 78 },
    { name: 'Analyst/Investigator', count: 22, color: '#8b5cf6', avgEngagement: 92 },
    { name: 'Champion/Persuader', count: 8, color: '#f59e0b', avgEngagement: 71 },
    { name: 'Individualist', count: 10, color: '#ec4899', avgEngagement: 76 },
    { name: 'Problem Solver/Detective', count: 15, color: '#06b6d4', avgEngagement: 88 },
    { name: 'Challenger/Debater', count: 7, color: '#ef4444', avgEngagement: 73 },
  ];

  const totalEmployees = employeeWorkerTypes.reduce((sum, type) => sum + type.count, 0);
  const employeeTypesWithPercentages = employeeWorkerTypes.map(type => ({
    ...type,
    percentage: totalEmployees > 0 ? ((type.count / totalEmployees) * 100).toFixed(1) : '0.0',
  }));

  const dominantEmployeeType = employeeTypesWithPercentages.reduce((prev, current) =>
    current.count > prev.count ? current : prev
  );

  // Fetch real lecture data from API
  useEffect(() => {
    const fetchLectures = async () => {
      if (!user || user.role !== 'instructor') {
        setIsLoadingLectures(false);
        return;
      }

      try {
        setIsLoadingLectures(true);
        const response = await getInstructorLectures(user.id);
        
        if (response.success && response.data) {
          const { lectures: transformedLectures, courses: apiCourses } = transformInstructorLectures(response);
          const enrichedLectures = enrichLecturesWithMockData(transformedLectures);
          
          // Update courses from API
          if (apiCourses && apiCourses.length > 0) {
            const updatedCourses = (apiCourses as ApiInstructorCourse[]).map((apiCourse) => ({
              id: apiCourse.courseId,
              name: apiCourse.courseName ?? apiCourse.courseId,
              code: apiCourse.courseId,
              instructorId: apiCourse.instructorId ?? user.id,
              lectureIds: apiCourse.lectures?.map((l) => l.lectureId) || [],
            }));
            setCourses(updatedCourses);
            
            // Set first course as selected if no course is selected
            if (!selectedCourseId && updatedCourses.length > 0) {
              setSelectedCourseId(updatedCourses[0].id);
            }
          }
          
          if (enrichedLectures.length > 0) {
            setLectures(enrichedLectures);
            // Select first lecture of the selected course, or first lecture overall
            const courseLectures = selectedCourseId 
              ? enrichedLectures.filter(l => l.courseId === selectedCourseId)
              : enrichedLectures;
            if (courseLectures.length > 0) {
              setSelectedLecture(courseLectures[0]);
            } else {
              setSelectedLecture(enrichedLectures[0]);
            }
          } else {
            // No lectures found
            setLectures([]);
            setSelectedLecture(null);
          }
        } else {
          // No course data, use mock data
          setLectures(mockLectures);
          if (mockLectures.length > 0) {
            setSelectedLecture(mockLectures[0]);
            setSelectedCourseId(mockLectures[0].courseId);
          }
        }
      } catch (error) {
        console.error('Failed to fetch instructor lectures, using mock data:', error);
        // Fallback to mock data
        setLectures(mockLectures);
        if (mockLectures.length > 0) {
          setSelectedLecture(mockLectures[0]);
          setSelectedCourseId(mockLectures[0].courseId);
        }
      } finally {
        setIsLoadingLectures(false);
      }
    };

    fetchLectures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Set initial selected lecture if not set
  useEffect(() => {
    if (!selectedLecture && lectures.length > 0) {
      setSelectedLecture(lectures[0]);
    }
  }, [lectures, selectedLecture]);

  // Fetch watch progress when selected lecture changes
  useEffect(() => {
    const fetchWatchProgress = async () => {
      if (!selectedLecture) {
        setWatchProgressData(null);
        return;
      }

      try {
        setIsLoadingWatchProgress(true);
        const response = await getLectureWatchProgress(selectedLecture.id);
        if (response && response.success && response.data) {
          setWatchProgressData({
            retentionData: response.data.retentionData || [],
            totalStudents: response.data.totalStudents || 0,
          });
        } else {
          setWatchProgressData(null);
        }
      } catch (error) {
        // Silently fail - watch progress is optional
        console.debug('Watch progress not available:', error);
        setWatchProgressData(null);
      } finally {
        setIsLoadingWatchProgress(false);
      }
    };

    fetchWatchProgress();
  }, [selectedLecture]);

  const conceptInsights = useMemo(() => calculateConceptInsights(), []);
  const clusterInsights = useMemo(() => calculateClusterInsights(), []);

  // Get course from selectedCourseId or from selectedLecture
  const course = selectedCourseId 
    ? courses.find(c => c.id === selectedCourseId)
    : selectedLecture 
      ? courses.find(c => c.id === selectedLecture.courseId)
      : courses.length > 0 
        ? courses[0] 
        : null;

  const handleSwitchCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    const newCourse = courses.find(c => c.id === courseId);
    if (newCourse && newCourse.lectureIds.length > 0) {
      const firstLecture = lectures.find(l => l.courseId === courseId);
      if (firstLecture) {
        setSelectedLecture(firstLecture);
      } else {
        setSelectedLecture(null);
      }
    } else {
      setSelectedLecture(null);
    }
    setIsCourseDialogOpen(false);
    setIsCourseActionDialogOpen(false);
  };

  const openCourseManager = (tab: 'switch' | 'create' = 'switch') => {
    setCourseDialogTab(tab);
    setIsCourseDialogOpen(true);
  };

  const handleCourseClick = (courseId: string) => {
    if (courseId === course?.id) {
      // If clicking on the current course, just switch to it directly
      handleSwitchCourse(courseId);
    } else {
      // For other courses, show the action dialog
      setClickedCourseId(courseId);
      setIsCourseActionDialogOpen(true);
    }
  };

  const handleGoToCourse = () => {
    if (clickedCourseId) {
      handleSwitchCourse(clickedCourseId);
    }
  };

  const handleOpenCourseSettings = async () => {
    setIsCourseActionDialogOpen(false);
    
    // Reset state
    setNewStudentEmail('');
    
    setIsCourseSettingsOpen(true);
    
    if (clickedCourseId) {
      const selectedCourse = courses.find(c => c.id === clickedCourseId);
      if (selectedCourse) {
        setCourseSettingsName(selectedCourse.name);
        setCourseSettingsCode(selectedCourse.code);
        
        // Fetch enrolled students
        try {
          setIsLoadingStudents(true);
          const response = await getCourseStudents(clickedCourseId);
          if (response.success && response.data) {
            setCourseStudents(response.data);
          }
        } catch (error) {
          console.error('Failed to fetch course students:', error);
          toast({
            title: 'Error',
            description: 'Failed to load enrolled students',
            variant: 'destructive',
          });
        } finally {
          setIsLoadingStudents(false);
        }
      }
    }
  };

  // Add a student to the course
  const handleAddStudent = async () => {
    if (!clickedCourseId || !newStudentEmail.trim()) return;

    const email = newStudentEmail.trim().toLowerCase();

    // Check if student is already enrolled
    const isAlreadyEnrolled = courseStudents.some(s => s.email.toLowerCase() === email);
    if (isAlreadyEnrolled) {
      toast({
        title: 'Error',
        description: 'This student is already enrolled in the course',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await addStudentsToCourse(clickedCourseId, [email]);
      if (response.success) {
        // Refresh student list
        const studentsResponse = await getCourseStudents(clickedCourseId);
        if (studentsResponse.success && studentsResponse.data) {
          setCourseStudents(studentsResponse.data);
        }
        
        // Clear input
        setNewStudentEmail('');
        
        toast({
          title: 'Success',
          description: `Student ${email} has been added to the course`,
        });
      }
    } catch (error: unknown) {
      console.error('Failed to add student:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to add student to course',
        variant: 'destructive',
      });
    }
  };

  // Remove a student from the course
  const handleRemoveStudent = async (userId: string, email: string) => {
    if (!clickedCourseId) return;

    try {
      const response = await removeStudentFromCourse(clickedCourseId, userId);
      if (response.success) {
        // Remove from local state
        setCourseStudents(courseStudents.filter(s => s.userId !== userId));
        
        toast({
          title: 'Success',
          description: `Student ${email} has been removed from the course`,
        });
      }
    } catch (error: unknown) {
      console.error('Failed to remove student:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to remove student from course',
        variant: 'destructive',
      });
    }
  };

  // Save course settings
  const handleSaveCourseSettings = async () => {
    if (!clickedCourseId) return;

    try {
      setIsSavingCourse(true);
      const newCourseId = courseSettingsCode.trim() !== clickedCourseId ? courseSettingsCode.trim() : undefined;
      const response = await updateCourse(
        clickedCourseId,
        courseSettingsName.trim(),
        newCourseId
      );

      if (response.success) {
        // Update local courses state
        const updatedCourses = courses.map(c => {
          if (c.id === clickedCourseId) {
            return {
              ...c,
              id: newCourseId || c.id,
              name: courseSettingsName.trim(),
              code: courseSettingsCode.trim(),
            };
          }
          return c;
        });
        setCourses(updatedCourses);
        
        // Update selected course if it was the one we edited
        if (selectedCourseId === clickedCourseId && newCourseId) {
          setSelectedCourseId(newCourseId);
        }
        
        toast({
          title: 'Success',
          description: 'Course settings have been updated',
        });
        
        setIsCourseSettingsOpen(false);
      }
    } catch (error: unknown) {
      console.error('Failed to save course settings:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to save course settings',
        variant: 'destructive',
      });
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourseCode.trim() || !newCourseName.trim() || !user) {
      return;
    }

    try {
      // Parse email list (split by comma, newline, or semicolon, and trim)
      const emailList = studentEmails
        .split(/[,\n;]/)
        .map(email => email.trim())
        .filter(email => email.length > 0);

      // Create course in database
      const response = await createCourse(newCourseCode.trim(), newCourseName.trim(), user.id, emailList);
      
      // Show assignment results
      if (emailList.length > 0) {
        const assignedCount = response.assignedStudents?.length || 0;
        const notFoundCount = response.notFoundEmails?.length || 0;
        
        if (assignedCount > 0 && notFoundCount === 0) {
          toast({
            title: "Course created successfully",
            description: `Assigned ${assignedCount} student${assignedCount !== 1 ? 's' : ''} to the course.`,
          });
        } else if (assignedCount > 0 && notFoundCount > 0) {
          toast({
            title: "Course created with partial assignments",
            description: `Assigned ${assignedCount} student${assignedCount !== 1 ? 's' : ''}. ${notFoundCount} email${notFoundCount !== 1 ? 's' : ''} not found.`,
            variant: "default",
          });
        } else if (notFoundCount > 0) {
          toast({
            title: "Course created, but no students assigned",
            description: `${notFoundCount} email${notFoundCount !== 1 ? 's' : ''} not found. Please verify the email addresses.`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Course created successfully",
          description: "You can assign students later.",
        });
      }
      
      // Update local state
      const newCourse = {
        id: newCourseCode.trim(),
        name: newCourseName.trim(),
        code: newCourseCode.trim(),
        instructorId: user.id,
        lectureIds: [],
      };

      setCourses([...courses, newCourse]);
      setSelectedCourseId(newCourseCode.trim()); // Select the newly created course
      setSelectedLecture(null); // No lectures yet
      setNewCourseCode('');
      setNewCourseName('');
      setStudentEmails('');
      setIsCourseDialogOpen(false);
    } catch (error) {
      console.error('Failed to create course:', error);
      // Still update UI even if API call fails (for offline support)
      const newCourse = {
        id: newCourseCode.trim(),
        name: newCourseName.trim(),
        code: newCourseCode.trim(),
        instructorId: user.id,
        lectureIds: [],
      };
      setCourses([...courses, newCourse]);
      setNewCourseCode('');
      setNewCourseName('');
      setStudentEmails('');
      setIsCourseDialogOpen(false);
    }
  };

  // Prepare chart data
  const struggleChartData = selectedLecture
    ? conceptInsights
        .filter(c => selectedLecture.concepts.find(lc => lc.id === c.conceptId))
        .map(insight => ({
      name: insight.conceptName.length > 15 
        ? insight.conceptName.substring(0, 15) + '...' 
        : insight.conceptName,
          fullName: insight.conceptName,
          replays: insight.replayCount,
          dropOffs: insight.dropOffCount,
          struggleScore: Math.round(insight.struggleScore),
        }))
    : [];

  const clusterChartData = clusterInsights.map(cluster => ({
    name: cluster.cluster.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    students: cluster.studentCount,
    engagement: Math.round(cluster.avgEngagement),
  }));

  const clusterPieData = clusterInsights.map(cluster => ({
    name: cluster.cluster.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    value: cluster.studentCount,
  }));

  // Timeline data for drop-off visualization
  // Use real watch progress data if available, otherwise fall back to mock data
  const timelineData = watchProgressData?.retentionData && watchProgressData.retentionData.length > 0
    ? watchProgressData.retentionData.map((data) => ({
        name: `${Math.floor(data.time / 60)}:${String(Math.floor(data.time % 60)).padStart(2, '0')}`,
        time: `${Math.floor(data.time / 60)}:${String(Math.floor(data.time % 60)).padStart(2, '0')}`,
        viewers: data.retention,
        replays: 0, // Replays not tracked in watch progress yet
      }))
    : selectedLecture
      ? selectedLecture.concepts.map(concept => {
          const insight = conceptInsights.find(i => i.conceptId === concept.id);
          return {
            name: concept.name.substring(0, 10) + '...',
            time: `${Math.floor(concept.startTime / 60)}:${String(concept.startTime % 60).padStart(2, '0')}`,
            viewers: 100 - (insight?.dropOffCount || 0) * 2,
            replays: insight?.replayCount || 0,
          };
        })
      : [];

  const topStrugglingConcepts = conceptInsights.slice(0, 3);

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
            <Badge variant="outline" className="ml-2 bg-instructor/10 text-instructor border-instructor/30">
              Instructor View
            </Badge>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Aggregated Data Only</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {isLoadingLectures ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading lectures...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Course Header - Always show if course exists */}
            {course && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9">
                            <span className="font-medium">{course.code}</span>
                            <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[320px]">
                          <DropdownMenuLabel>Courses</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {courses.length === 0 ? (
                            <DropdownMenuItem disabled>No courses yet</DropdownMenuItem>
                          ) : (
                            courses.map((c) => (
                              <DropdownMenuItem
                                key={c.id}
                                onSelect={() => handleSwitchCourse(c.id)}
                                className={c.id === course.id ? 'bg-muted' : undefined}
                              >
                                <div className="flex w-full items-center justify-between gap-3">
                                  <div className="font-medium">{c.code}</div>
                                  {c.id === course.id && (
                                    <Badge variant="outline" className="shrink-0">Current</Badge>
                                  )}
                                </div>
                              </DropdownMenuItem>
                            ))
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => openCourseManager('switch')}>
                            Manage courses…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openCourseManager('create')}
                        className="h-9 gradient-bg"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>
                    <h1 className="text-2xl font-bold leading-tight mt-0.5">{course.name}</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 justify-end">
                      {lectures
                        .filter(lecture => lecture.courseId === course.id)
                        .map(lecture => (
                          <Button
                            key={lecture.id}
                            variant={selectedLecture?.id === lecture.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedLecture(lecture)}
                            className={selectedLecture?.id === lecture.id ? 'gradient-bg' : ''}
                          >
                            {lecture.title.length > 20 ? lecture.title.substring(0, 20) + '...' : lecture.title}
                          </Button>
                        ))}
                    </div>
                    <div className="shrink-0 ml-auto">
                      <UploadVideo 
                        courseId={course.id}
                        onUploadComplete={(lectureId, videoUrl) => {
                          console.log('Upload complete:', lectureId, videoUrl);
                          // Refresh lectures after upload
                          if (user) {
                            getInstructorLectures(user.id)
                              .then(response => {
                                if (response.success && response.data) {
                                  const { lectures: transformedLectures } = transformInstructorLectures(response);
                                  const enrichedLectures = enrichLecturesWithMockData(transformedLectures);
                                  setLectures(enrichedLectures);
                                  if (enrichedLectures.length > 0 && !selectedLecture) {
                                    setSelectedLecture(enrichedLectures[0]);
                                  }
                                }
                              })
                              .catch(error => {
                                console.error('Failed to refresh lectures:', error);
                              });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Show message if no lectures but course exists */}
            {course && !selectedLecture && lectures.filter(l => l.courseId === course.id).length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No lectures available for this course yet</p>
                <p className="text-sm text-muted-foreground">Use the Upload Video button above to add your first lecture</p>
              </div>
            )}

            {/* Main Content - Only show if there's a selected lecture */}
            {selectedLecture && (
              <>
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Users, label: 'Total Employees', value: mockStudents.length, color: 'text-primary' },
            { icon: Eye, label: 'Avg. Watch Rate', value: '78%', color: 'text-chart-3' },
            { icon: AlertTriangle, label: 'Friction Points', value: topStrugglingConcepts.length, color: 'text-destructive' },
            { icon: Activity, label: 'Engagement Score', value: '82/100', color: 'text-chart-2' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-muted ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Analytics */}
        <Tabs defaultValue="concepts" className="space-y-6">
          <TabsList className="glass-card p-1">
            <TabsTrigger value="concepts" className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4" />
              Concept Analysis
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Timeline View
            </TabsTrigger>
            <TabsTrigger value="clusters" className="flex items-center gap-2">
              <PieIcon className="w-4 h-4" />
              Behavioral Clusters
            </TabsTrigger>
            <TabsTrigger value="worker-types" className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Worker Types
            </TabsTrigger>
          </TabsList>

          {/* Concept Analysis Tab */}
          <TabsContent value="concepts" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Struggle Score Chart */}
              <Card className="glass-card lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Most Misunderstood Concepts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={struggleChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={120}
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelFormatter={(_, payload) => payload[0]?.payload?.fullName}
                      />
                      <Bar dataKey="replays" fill={CHART_COLORS[0]} name="Replays" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="dropOffs" fill={CHART_COLORS[3]} name="Drop-offs" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top Friction Points */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Top Friction Points
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {topStrugglingConcepts.map((concept, i) => (
                    <motion.div
                      key={concept.conceptId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-4 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{concept.conceptName}</span>
                        <Badge 
                          variant={concept.struggleScore > 60 ? 'destructive' : 'secondary'}
                        >
                          {Math.round(concept.struggleScore)}% struggle
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{concept.replayCount} replays</span>
                        <span>{concept.dropOffCount} drop-offs</span>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Segment Rewinds Chart */}
            {selectedLecture?.lectureSegments && selectedLecture.lectureSegments.length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-primary" />
                    Segment Rewind Count
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={selectedLecture.lectureSegments.map((seg, index) => ({
                      name: seg.title.length > 20 ? seg.title.substring(0, 20) + '...' : seg.title,
                      fullName: seg.title,
                      rewinds: seg.count || 0,
                      index,
                      time: `${Math.floor(seg.start / 60)}:${String(Math.floor(seg.start % 60)).padStart(2, '0')}`,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="name" 
                        stroke="hsl(var(--muted-foreground))" 
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: unknown, _name: unknown, props: unknown) => {
                          const count = typeof value === 'number' ? value : Number(value);
                          const payload = (props as { payload?: { index?: number; fullName?: string } })?.payload;
                          const segmentIndex = payload?.index ?? 0;
                          const fullName = payload?.fullName ?? '';
                          return [
                            `${Number.isFinite(count) ? count : value} rewind${count !== 1 ? 's' : ''}`,
                            `Segment ${segmentIndex + 1}: ${fullName}`,
                          ];
                        }}
                      />
                      <Bar dataKey="rewinds" fill={CHART_COLORS[2]} name="Rewinds" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Viewer Retention Timeline - {selectedLecture.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="viewers" 
                      stroke={CHART_COLORS[0]} 
                      fill={CHART_COLORS[0]}
                      fillOpacity={0.3}
                      name="Viewers (%)"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="replays" 
                      stroke={CHART_COLORS[1]} 
                      fill={CHART_COLORS[1]}
                      fillOpacity={0.3}
                      name="Replays"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clusters Tab */}
          <TabsContent value="clusters" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Cluster Distribution Pie */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Behavioral Cluster Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={clusterPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {clusterPieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Cluster Engagement Bar */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-primary" />
                    Engagement by Cluster
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={clusterChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="engagement" fill={CHART_COLORS[0]} name="Engagement %" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Cluster Details */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Cluster-Concept Struggle Matrix
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clusterInsights.map((cluster, i) => (
                    <motion.div
                      key={cluster.cluster}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-4 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="font-medium">
                          {cluster.cluster.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </span>
                        <Badge variant="outline" className="ml-auto">
                          {cluster.studentCount} students
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">Struggling with:</p>
                      <div className="flex flex-wrap gap-1">
                        {cluster.strugglingConcepts.length > 0 ? (
                          cluster.strugglingConcepts.map(concept => (
                            <Badge key={concept} variant="secondary" className="text-xs">
                              {concept}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No major struggles detected</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Worker Types Tab */}
          <TabsContent value="worker-types" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Worker Type Distribution Pie */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieIcon className="w-5 h-5 text-primary" />
                    Worker Type Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={employeeTypesWithPercentages}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="name"
                      >
                        {employeeTypesWithPercentages.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: unknown, name: unknown, props: unknown) => {
                          const payload = (props as { payload?: { percentage?: string } })?.payload;
                          const percentage = payload?.percentage ?? '';
                          return [`${value} employees (${percentage}%)`, String(name)];
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Dominant Type</p>
                    <p className="font-semibold" style={{ color: dominantEmployeeType.color }}>
                      {dominantEmployeeType.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dominantEmployeeType.count} employees ({dominantEmployeeType.percentage}%)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Engagement by Worker Type */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Engagement by Worker Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={employeeTypesWithPercentages} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: unknown) => [`${value}%`, 'Engagement']}
                      />
                      <Bar dataKey="avgEngagement" name="Avg Engagement %" radius={[0, 4, 4, 0]}>
                        {employeeTypesWithPercentages.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Worker Type Details */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Worker Type Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employeeTypesWithPercentages
                    .sort((a, b) => b.count - a.count)
                    .map((type, i) => (
                      <motion.div
                        key={type.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-4 rounded-lg border"
                        style={{ 
                          backgroundColor: `${type.color}10`,
                          borderColor: `${type.color}30`
                        }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: type.color }}
                          />
                          <span className="font-medium text-sm">{type.name}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Employees</span>
                            <Badge variant="outline">
                              {type.count} ({type.percentage}%)
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Avg Engagement</span>
                            <Badge
                              variant={type.avgEngagement >= 85 ? 'default' : 'secondary'}
                            >
                              {type.avgEngagement}%
                            </Badge>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </div>

                <div className="mt-6 p-4 rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Key Insights
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>
                        <strong className="text-foreground">Analyst/Investigator</strong> types show the highest engagement ({employeeTypesWithPercentages.find(t => t.name === 'Analyst/Investigator')?.avgEngagement}%), suggesting content resonates well with analytical learners
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>
                        Most employees identify as <strong className="text-foreground">{dominantEmployeeType.name}</strong> ({dominantEmployeeType.percentage}%), indicating a workforce strength in this area
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>
                        Consider tailoring content delivery to accommodate diverse learning styles across all {employeeTypesWithPercentages.length} worker types
                      </span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

                {/* Privacy Notice */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-8 text-center"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm">
                    <Shield className="w-4 h-4" />
                    All data is anonymized and aggregated. Individual student identities are never exposed.
                  </div>
                </motion.div>
              </>
            )}
          </>
        )}
      </main>

      {/* Course Management Dialog */}
      <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Courses</DialogTitle>
            <DialogDescription>
              Switch to an existing course or create a new one
            </DialogDescription>
          </DialogHeader>

          <Tabs value={courseDialogTab} onValueChange={(v) => setCourseDialogTab(v as 'switch' | 'create')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="switch">Switch Course</TabsTrigger>
              <TabsTrigger value="create">Create New</TabsTrigger>
            </TabsList>

            <TabsContent value="switch" className="space-y-4 mt-4">
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No courses available. Create a new course to get started.
                  </p>
                ) : (
                  courses.map((c) => (
                    <motion.div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSwitchCourse(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleSwitchCourse(c.id);
                      }}
                      className={`group w-full p-4 rounded-lg border text-left transition-all ${
                        c.id === course?.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{c.code}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {c.lectureIds.length} lecture{c.lectureIds.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.id === course?.id && (
                            <Badge variant="default">Current</Badge>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setClickedCourseId(c.id);
                              setIsCourseDialogOpen(false);
                              setIsCourseActionDialogOpen(true);
                            }}
                            aria-label={`Edit ${c.code}`}
                          >
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="create" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="course-code">Course Code</Label>
                  <Input
                    id="course-code"
                    placeholder="e.g., CS 4820"
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course-name">Course Name</Label>
                  <Input
                    id="course-name"
                    placeholder="e.g., Introduction to Machine Learning"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-emails">Assign Students (Optional)</Label>
                  <textarea
                    id="student-emails"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter email addresses, one per line or separated by commas&#10;e.g., student1@example.com&#10;student2@example.com"
                    value={studentEmails}
                    onChange={(e) => setStudentEmails(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter employee email addresses to automatically assign them to this course
                  </p>
                </div>
                <Button
                  onClick={handleCreateCourse}
                  disabled={!newCourseCode.trim() || !newCourseName.trim()}
                  className="w-full gradient-bg"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Course
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Course Action Dialog */}
      <Dialog open={isCourseActionDialogOpen} onOpenChange={setIsCourseActionDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Course Options</DialogTitle>
            <DialogDescription>
              Choose an action for {clickedCourseId ? courses.find(c => c.id === clickedCourseId)?.name : 'this course'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              onClick={handleGoToCourse}
              className="w-full justify-start"
              variant="outline"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Go to Course
            </Button>
            <Button
              onClick={handleOpenCourseSettings}
              className="w-full justify-start"
              variant="outline"
            >
              <Settings className="w-4 h-4 mr-2" />
              Course Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Settings Dialog */}
      <Dialog open={isCourseSettingsOpen} onOpenChange={(open) => {
        setIsCourseSettingsOpen(open);
        if (!open) {
          // Reset state when dialog closes
          setNewStudentEmail('');
          setIsSavingCourse(false);
        }
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Course Settings</DialogTitle>
            <DialogDescription>
              Manage settings for {clickedCourseId ? courses.find(c => c.id === clickedCourseId)?.name : 'this course'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {clickedCourseId && (
              <>
                {/* Course Information */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="course-code">Course Code</Label>
                    <Input
                      id="course-code"
                      value={courseSettingsCode}
                      onChange={(e) => setCourseSettingsCode(e.target.value)}
                      placeholder="e.g., CS 4820"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="course-name">Course Name</Label>
                    <Input
                      id="course-name"
                      value={courseSettingsName}
                      onChange={(e) => setCourseSettingsName(e.target.value)}
                      placeholder="e.g., Introduction to Machine Learning"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Number of Lectures</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {courses.find(c => c.id === clickedCourseId)?.lectureIds.length || 0}
                    </p>
                  </div>
                </div>

                {/* Student Management */}
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label htmlFor="student-email">Add Student</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="student-email"
                        value={newStudentEmail}
                        onChange={(e) => setNewStudentEmail(e.target.value)}
                        placeholder="Enter student email..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddStudent();
                          }
                        }}
                      />
                      <Button onClick={handleAddStudent} disabled={!newStudentEmail.trim()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the email address of the student you want to add to this course
                    </p>
                  </div>

                  {/* Enrolled Students List */}
                  <div>
                    <Label>Enrolled Students ({courseStudents.length})</Label>
                    {isLoadingStudents ? (
                      <div className="mt-2 text-center py-4 text-sm text-muted-foreground">
                        Loading students...
                      </div>
                    ) : courseStudents.length === 0 ? (
                      <div className="mt-2 text-center py-4 text-sm text-muted-foreground border rounded-md">
                        No students enrolled in this course
                      </div>
                    ) : (
                      <div className="mt-2 space-y-1 border rounded-md bg-card max-h-60 overflow-y-auto">
                        {courseStudents.map((student) => (
                          <div
                            key={student.userId}
                            className="flex items-center justify-between p-2 hover:bg-muted"
                          >
                            <div>
                              <p className="text-sm font-medium">{student.email}</p>
                              <p className="text-xs text-muted-foreground">{student.pseudonymId}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveStudent(student.userId, student.email)}
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCourseSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCourseSettings} disabled={isSavingCourse}>
              <Save className="w-4 h-4 mr-2" />
              {isSavingCourse ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ChatWidget
        lectureId={selectedLecture?.id}
        videoTitle={selectedLecture?.title}
      />
    </div>
  );
};

export default InstructorDashboard;
