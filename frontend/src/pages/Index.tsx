import { useAuth } from '@/contexts/AuthContext';
import Login from './Login';
import StudentDashboard from './StudentDashboard';
import InstructorDashboard from './InstructorDashboard';

const Index = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking for session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Login />;
  }

  if (user.role === 'instructor') {
    return <InstructorDashboard />;
  }

  return <StudentDashboard />;
};

export default Index;
