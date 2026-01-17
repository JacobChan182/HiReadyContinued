import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { GraduationCap, Users, Lock, Zap, Shield, Mail, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const Login = () => {
  const { signup, signin, error: authError } = useAuth();
  const [mode, setMode] = useState<'select' | 'signup' | 'signin'>('select');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!selectedRole || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signup(email, password, selectedRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignin = async () => {
    if (!selectedRole || !email || !password) {
      setError('Please fill in all fields and select a role');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signin(email, password, selectedRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

    // This will now be automatically routed to http://localhost:5001/api/hello
  const fetchData = async () => {
    const response = await fetch('/api/hello'); 
    const data = await response.json();
    console.log(data);
  };

  const roles = [
    {
      id: 'student' as UserRole,
      title: 'Student',
      description: 'Access lectures, track progress, and get personalized insights',
      icon: GraduationCap,
      features: ['Watch lecture videos', 'Search by concept', 'Get catch-up summaries'],
    },
    {
      id: 'instructor' as UserRole,
      title: 'Instructor',
      description: 'View aggregated class analytics and identify learning friction',
      icon: Users,
      features: ['Class-wide analytics', 'Concept difficulty insights', 'Behavioral clusters'],
    },
  ];

  const displayError = error || authError;

  return (
    <div className="min-h-screen gradient-dark-bg flex items-center justify-center p-4">
      fetchData();
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 mb-4"
          >
            <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center glow">
              <Zap className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold text-white">
              Edu<span className="gradient-text">Pulse</span>.tech
            </span>
          </motion.div>
          <p className="text-slate-400 text-lg max-w-md mx-auto">
            Identity-aware learning analytics powered by AI video intelligence
          </p>
        </div>

        {/* Mock LMS Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
            <Lock className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">Blackboard LMS Integration</span>
          </div>
        </motion.div>

        {mode === 'select' && (
          <>
            {/* Role Selection Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {roles.map((role, index) => (
                <motion.div
                  key={role.id}
                  initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <Card
                    onClick={() => setSelectedRole(role.id)}
                    className={`glass-card cursor-pointer p-6 transition-all duration-300 ${
                      selectedRole === role.id
                        ? 'ring-2 ring-primary glow'
                        : 'hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${
                        selectedRole === role.id ? 'gradient-bg' : 'bg-muted'
                      }`}>
                        <role.icon className={`w-6 h-6 ${
                          selectedRole === role.id ? 'text-primary-foreground' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-card-foreground mb-1">{role.title}</h3>
                        <p className="text-muted-foreground text-sm mb-4">{role.description}</p>
                        <ul className="space-y-2">
                          {role.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Mode Selection Buttons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    if (selectedRole) {
                      setMode('signup');
                      setError(null);
                    }
                  }}
                  disabled={!selectedRole}
                  variant="outline"
                  className="px-6"
                >
                  Sign Up
                </Button>
                <Button
                  onClick={() => {
                    if (selectedRole) {
                      setMode('signin');
                      setError(null);
                    }
                  }}
                  disabled={!selectedRole}
                  className="gradient-bg glow px-6"
                >
                  Sign In
                </Button>
              </div>

              {/* Privacy Notice */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Shield className="w-4 h-4" />
                <span>Your identity is pseudonymized. No personal data is stored.</span>
              </div>
            </motion.div>
          </>
        )}

        {(mode === 'signup' || mode === 'signin') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto"
          >
            <Card className="glass-card p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-card-foreground mb-2">
                  {mode === 'signup' ? 'Create Account' : 'Sign In'}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {mode === 'signup' 
                    ? `Sign up as ${selectedRole ? roles.find(r => r.id === selectedRole)?.title : '...'}`
                    : `Sign in as ${selectedRole ? roles.find(r => r.id === selectedRole)?.title : '...'}`
                  }
                </p>
              </div>

              {displayError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{displayError}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-card-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {mode === 'signup' && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Must be at least 6 characters
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    onClick={mode === 'signup' ? handleSignup : handleSignin}
                    disabled={isLoading || !selectedRole}
                    className="gradient-bg glow w-full"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                        />
                        {mode === 'signup' ? 'Creating Account...' : 'Signing In...'}
                      </span>
                    ) : (
                      mode === 'signup' ? 'Create Account' : 'Sign In'
                    )}
                  </Button>

                  <Button
                    onClick={() => {
                      setMode('select');
                      setEmail('');
                      setPassword('');
                      setError(null);
                    }}
                    variant="ghost"
                    className="w-full"
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                </div>

                {mode === 'signin' && (
                  <div className="text-center pt-4">
                    <button
                      onClick={() => {
                        setMode('select');
                        setEmail('');
                        setPassword('');
                        setError(null);
                      }}
                      className="text-sm text-muted-foreground hover:text-card-foreground"
                    >
                      Don't have an account? Choose a role to sign up
                    </button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
