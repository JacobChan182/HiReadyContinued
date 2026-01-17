import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { mockLectures, mockCourses } from '@/data/mockData';
import { Concept } from '@/types';
import { 
  Play, Pause, SkipForward, Search, Sparkles, Clock, 
  BookOpen, ChevronRight, Zap, LogOut, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const { trackEvent } = useAnalytics();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedLecture, setSelectedLecture] = useState(mockLectures[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [activeConcept, setActiveConcept] = useState<Concept | null>(null);

  const course = mockCourses.find(c => c.id === selectedLecture.courseId);

  // Track current concept based on video time
  useEffect(() => {
    const concept = selectedLecture.concepts.find(
      c => currentTime >= c.startTime && currentTime < c.endTime
    );
    if (concept && concept.id !== activeConcept?.id) {
      setActiveConcept(concept);
    }
  }, [currentTime, selectedLecture, activeConcept]);

  const handlePlayPause = () => {
    if (videoRef.current) {
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
    if (videoRef.current) {
      videoRef.current.currentTime = concept.startTime;
      setCurrentTime(concept.startTime);
      trackEvent('concept-jump', selectedLecture.id, concept.id);
      if (!isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const filteredConcepts = selectedLecture.concepts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateSummary = () => {
    setShowSummary(true);
    trackEvent('seek', selectedLecture.id, undefined, { action: 'generate-summary' });
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
                  <video
                    ref={videoRef}
                    src={selectedLecture.videoUrl}
                    className="w-full h-full object-cover"
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                  />
                  
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
                        value={(currentTime / selectedLecture.duration) * 100}
                        className="h-2"
                      />
                    </div>
                    
                    <span className="text-sm font-mono text-muted-foreground">
                      {formatTime(currentTime)} / {formatTime(selectedLecture.duration)}
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
                          flex: (concept.endTime - concept.startTime) / selectedLecture.duration 
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
                  <p className="text-sm text-muted-foreground">{course?.code}</p>
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
                {mockLectures.filter(l => l.id !== selectedLecture.id).map(lecture => (
                  <div
                    key={lecture.id}
                    onClick={() => setSelectedLecture(lecture)}
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                  >
                    <p className="font-medium text-sm">{lecture.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {lecture.concepts.length} concepts • {formatTime(lecture.duration)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
