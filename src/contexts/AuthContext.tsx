import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, UserRole, BehavioralCluster } from '@/types';
import { signup, signin } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  signup: (email: string, password: string, role: UserRole) => Promise<void>;
  signin: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleSignin = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      const response = await signin(email, password);
      
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

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      signup: handleSignup, 
      signin: handleSignin, 
      logout, 
      isAuthenticated: !!user,
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
