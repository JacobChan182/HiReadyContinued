import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { mockLectures, mockCourses, calculateConceptInsights, calculateClusterInsights, mockStudents } from '@/data/mockData';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Zap, LogOut, Users, TrendingUp, AlertTriangle, BookOpen, 
  BarChart2, PieChart as PieIcon, Activity, Shield, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CHART_COLORS = [
  'hsl(173, 80%, 40%)',
  'hsl(262, 83%, 58%)',
  'hsl(45, 93%, 58%)',
  'hsl(0, 84%, 60%)',
  'hsl(215, 25%, 50%)',
];

const InstructorDashboard = () => {
  const { user, logout } = useAuth();
  const [selectedLecture, setSelectedLecture] = useState(mockLectures[0]);

  const conceptInsights = useMemo(() => calculateConceptInsights(), []);
  const clusterInsights = useMemo(() => calculateClusterInsights(), []);

  const course = mockCourses.find(c => c.id === selectedLecture.courseId);

  // Prepare chart data
  const struggleChartData = conceptInsights
    .filter(c => mockLectures[0].concepts.find(lc => lc.id === c.conceptId))
    .map(insight => ({
      name: insight.conceptName.length > 15 
        ? insight.conceptName.substring(0, 15) + '...' 
        : insight.conceptName,
      fullName: insight.conceptName,
      replays: insight.replayCount,
      dropOffs: insight.dropOffCount,
      struggleScore: Math.round(insight.struggleScore),
    }));

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
  const timelineData = selectedLecture.concepts.map(concept => {
    const insight = conceptInsights.find(i => i.conceptId === concept.id);
    return {
      name: concept.name.substring(0, 10) + '...',
      time: `${Math.floor(concept.startTime / 60)}:${String(concept.startTime % 60).padStart(2, '0')}`,
      viewers: 100 - (insight?.dropOffCount || 0) * 2,
      replays: insight?.replayCount || 0,
    };
  });

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
        {/* Course Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{course?.code}</p>
              <h1 className="text-2xl font-bold">{course?.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              {mockLectures.map(lecture => (
                <Button
                  key={lecture.id}
                  variant={selectedLecture.id === lecture.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedLecture(lecture)}
                  className={selectedLecture.id === lecture.id ? 'gradient-bg' : ''}
                >
                  {lecture.title.substring(0, 20)}...
                </Button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Users, label: 'Total Students', value: mockStudents.length, color: 'text-primary' },
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
      </main>
    </div>
  );
};

export default InstructorDashboard;
