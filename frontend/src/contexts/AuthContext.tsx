import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole, BehavioralCluster } from '@/types';
import { signup, signin, getMe, logout as logoutApi } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  signup: (email: string, password: string, role: UserRole) => Promise<void>;
  signin: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await getMe();
        if (response.success && response.data) {
          const userData = response.data;
          const restoredUser: User = {
            id: userData.id,
            pseudonymId: userData.pseudonymId,
            role: userData.role,
            courseIds: userData.courseIds || [],
            cluster: userData.cluster as BehavioralCluster | undefined,
            createdAt: new Date(userData.createdAt),
          };
          setUser(restoredUser);
        }
      } catch (err) {
        // Silent fail - no session exists
        console.error('Failed to restore session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleSignup = useCallback(async (email: string, password: string, role: UserRole) => {
    try {
      setError(null);
      const response = await signup(email, password, role);
      
      if (response.success && response.data) {
        const userData = response.data;
        const newUser: User = {
          id: userData.id,
          pseudonymId: userData.pseudonymId,
          role: userData.role,
          courseIds: userData.courseIds || [],
          cluster: userData.cluster as BehavioralCluster | undefined,
          createdAt: new Date(userData.createdAt),
        };
        setUser(newUser);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign up';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const handleSignin = useCallback(async (email: string, password: string, role: UserRole) => {
    try {
      setError(null);
      const response = await signin(email, password, role);
      
      if (response.success && response.data) {
        const userData = response.data;
        const newUser: User = {
          id: userData.id,
          pseudonymId: userData.pseudonymId,
          role: userData.role,
          courseIds: userData.courseIds || [],
          cluster: userData.cluster as BehavioralCluster | undefined,
          createdAt: new Date(userData.createdAt),
        };
        setUser(newUser);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      setUser(null);
      setError(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      signup: handleSignup, 
      signin: handleSignin, 
      logout, 
      isAuthenticated: !!user,
      isLoading,
      error,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
