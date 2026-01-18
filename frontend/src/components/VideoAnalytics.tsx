import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertCircle, TrendingUp, Users, Zap, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getVideoAnalytics } from '@/lib/api';

interface AnalyticsData {
  totalStudents?: number;
  dropOffPoints?: Array<{ timestamp: number; studentCount: number; percentage: number }>;
  rewindFrequency?: Array<{ conceptName: string; rewindCount: number }>;
  engagementScore?: number;
  strugglingSegments?: Array<{ startTime: number; endTime: number; name: string; rewindCount: number }>;
  averageRewindCount?: number;
}

interface VideoAnalyticsProps {
  videoId?: string;
  lectureId?: string;
  lectureTitle?: string;
  className?: string;
}

const VideoAnalytics = ({
  videoId,
  lectureId,
  lectureTitle,
  className = '',
}: VideoAnalyticsProps) => {
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'segments' | 'engagement'>('overview');

  useEffect(() => {
    if (!videoId && !lectureId) return;

    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getVideoAnalytics(videoId || lectureId!);
        setAnalyticsData(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load analytics';
        setError(errorMessage);
        console.error('Analytics fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [videoId, lectureId]);

  if (!videoId && !lectureId) {
    return (
      <Card className={`p-6 bg-slate-50 ${className}`}>
        <p className="text-center text-slate-600">
          Select a video to view analytics
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={`p-6 flex items-center justify-center ${className}`}>
        <Loader2 className="animate-spin text-blue-500" size={24} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 bg-red-50 border border-red-200 ${className}`}>
        <div className="flex items-start gap-2">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Analytics</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`bg-white overflow-hidden ${className}`}>
      {/* Header */}
      <div className="border-b px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50">
        <h3 className="font-semibold text-slate-800">Video Analytics</h3>
        {lectureTitle && (
          <p className="text-sm text-slate-600 mt-1">{lectureTitle}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b px-6">
        {(['overview', 'segments', 'engagement'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {analyticsData?.totalStudents !== undefined && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={18} className="text-blue-600" />
                    <span className="text-sm font-medium text-slate-600">
                      Total Students
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {analyticsData.totalStudents}
                  </p>
                </div>
              )}

              {analyticsData?.engagementScore !== undefined && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={18} className="text-green-600" />
                    <span className="text-sm font-medium text-slate-600">
                      Engagement Score
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    {(analyticsData.engagementScore * 100).toFixed(1)}%
                  </p>
                </div>
              )}

              {analyticsData?.averageRewindCount !== undefined && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={18} className="text-purple-600" />
                    <span className="text-sm font-medium text-slate-600">
                      Avg Rewinds
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">
                    {analyticsData.averageRewindCount.toFixed(1)}
                  </p>
                </div>
              )}
            </div>

            {/* Drop-off Chart */}
            {analyticsData?.dropOffPoints && analyticsData.dropOffPoints.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-4">
                  Student Drop-off Timeline
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.dropOffPoints}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      label={{ value: 'Time (seconds)', position: 'insideBottomRight', offset: -5 }}
                    />
                    <YAxis
                      yAxisId="left"
                      label={{ value: 'Student Count', angle: -90, position: 'insideLeft' }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      label={{ value: 'Drop-off %', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="studentCount"
                      stroke="#3b82f6"
                      name="Students Watching"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="percentage"
                      stroke="#ef4444"
                      name="Drop-off %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Struggling Segments Tab */}
        {activeTab === 'segments' && (
          <div className="space-y-4">
            {analyticsData?.strugglingSegments && analyticsData.strugglingSegments.length > 0 ? (
              <>
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-800 mb-4">
                    Most Replayed Segments
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.strugglingSegments}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="rewindCount" fill="#8b5cf6" name="Rewind Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {analyticsData.strugglingSegments.map((segment, idx) => (
                    <div
                      key={idx}
                      className="border border-slate-200 rounded-lg p-4 bg-gradient-to-r from-slate-50 to-transparent"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h5 className="font-semibold text-slate-800">
                            {segment.name}
                          </h5>
                          <p className="text-sm text-slate-600 mt-1">
                            {Math.floor(segment.startTime / 60)}:
                            {String(segment.startTime % 60).padStart(2, '0')} -{' '}
                            {Math.floor(segment.endTime / 60)}:
                            {String(segment.endTime % 60).padStart(2, '0')}
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                          {segment.rewindCount} replays
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>No segment data available</p>
              </div>
            )}
          </div>
        )}

        {/* Engagement Tab */}
        {activeTab === 'engagement' && (
          <div className="space-y-6">
            {analyticsData?.rewindFrequency && analyticsData.rewindFrequency.length > 0 ? (
              <>
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-800 mb-4">
                    Rewind Frequency by Concept
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.rewindFrequency}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="conceptName" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="rewindCount" fill="#06b6d4" name="Rewind Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3">Insights</h4>
                  <ul className="space-y-2">
                    {analyticsData.rewindFrequency
                      .sort((a, b) => b.rewindCount - a.rewindCount)
                      .slice(0, 5)
                      .map((item, idx) => (
                        <li key={idx} className="text-sm text-blue-900">
                          <span className="font-medium">{item.conceptName}:</span>{' '}
                          {item.rewindCount} students rewound this concept
                        </li>
                      ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>No engagement data available yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default VideoAnalytics;
