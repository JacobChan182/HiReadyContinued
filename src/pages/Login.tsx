import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { GraduationCap, Users, Lock, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const Login = () => {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (!selectedRole) return;
    setIsLoggingIn(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    login(selectedRole);
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

  return (
    <div className="min-h-screen gradient-dark-bg flex items-center justify-center p-4">
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

        {/* Login Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col items-center gap-4"
        >
          <Button
            onClick={handleLogin}
            disabled={!selectedRole || isLoggingIn}
            size="lg"
            className="gradient-bg glow px-8 py-6 text-lg font-medium disabled:opacity-50"
          >
            {isLoggingIn ? (
              <span className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                />
                Creating Identity...
              </span>
            ) : (
              `Continue as ${selectedRole ? roles.find(r => r.id === selectedRole)?.title : '...'}`
            )}
          </Button>

          {/* Privacy Notice */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-4 h-4" />
            <span>Your identity is pseudonymized. No personal data is stored.</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
