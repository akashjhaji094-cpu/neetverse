import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Brain,
  Target,
  TrendingUp,
  Zap,
  BookOpen,
  Trophy,
  Clock,
  ChevronRight,
  Star,
  Flame,
  BarChart3,
  RotateCcw,
  Play,
  Lock,
  Crown,
  ArrowRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Timer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SkillLevel {
  chapter_id: string;
  chapter_name: string;
  subject_name: string;
  skill_level: number;
  questions_attempted: number;
  questions_correct: number;
  consecutive_correct: number;
  consecutive_wrong: number;
  last_attempted_at: string | null;
}

interface AdaptiveSession {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  mode: 'chapter' | 'subject' | 'mixed';
  target_skill_level: number;
  current_question_index: number;
  questions: any[];
  answers: Record<string, any>;
  status: 'active' | 'completed' | 'abandoned';
  started_at: string;
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  subject_name: string;
  duration_days: number;
  difficulty_level: string;
  is_premium: boolean;
  progress?: number;
  current_day?: number;
  status?: string;
}

interface DailyPlan {
  id: string;
  date: string;
  plan: any[];
  completed_tasks: any[];
  total_tasks: number;
  completed_count: number;
  study_time_minutes: number;
}

const SKILL_COLORS: Record<string, string> = {
  beginner: 'bg-red-500',
  novice: 'bg-orange-500',
  intermediate: 'bg-yellow-500',
  advanced: 'bg-blue-500',
  expert: 'bg-green-500',
  master: 'bg-purple-500',
};

const getSkillLabel = (level: number): string => {
  if (level < 20) return 'Beginner';
  if (level < 40) return 'Novice';
  if (level < 60) return 'Intermediate';
  if (level < 80) return 'Advanced';
  if (level < 95) return 'Expert';
  return 'Master';
};

const getSkillColor = (level: number): string => {
  if (level < 20) return 'text-red-500';
  if (level < 40) return 'text-orange-500';
  if (level < 60) return 'text-yellow-500';
  if (level < 80) return 'text-blue-500';
  if (level < 95) return 'text-green-500';
  return 'text-purple-500';
};

const getProgressColor = (level: number): string => {
  if (level < 20) return 'bg-red-500';
  if (level < 40) return 'bg-orange-500';
  if (level < 60) return 'bg-yellow-500';
  if (level < 80) return 'bg-blue-500';
  if (level < 95) return 'bg-green-500';
  return 'bg-purple-500';
};

// ─── Active Adaptive Session Component ───
const ActiveAdaptiveSession = ({ session, onComplete }: { session: AdaptiveSession; onComplete: () => void }) => {
  const [currentQIndex, setCurrentQIndex] = useState(session.current_question_index);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [answers, setAnswers] = useState<Record<string, any>>(session.answers || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const currentQuestion = session.questions[currentQIndex];
  const totalQuestions = session.questions.length;
  const progress = ((currentQIndex) / totalQuestions) * 100;

  useEffect(() => {
    if (timeLeft > 0 && !showExplanation) {
      const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, showExplanation]);

  const handleOptionSelect = (index: number) => {
    if (showExplanation) return;
    setSelectedOption(index);
  };

  const handleSubmit = async () => {
    if (selectedOption === null) return;
    setIsSubmitting(true);

    const isCorrect = selectedOption === currentQuestion.correct_option_index;
    const newAnswers = {
      ...answers,
      [currentQuestion.id]: {
        option_index: selectedOption,
        is_correct: isCorrect,
        time_taken: 120 - timeLeft,
      }
    };
    setAnswers(newAnswers);
    setShowExplanation(true);

    // Update session in DB
    await supabase.from('adaptive_learning_sessions').update({
      current_question_index: currentQIndex,
      answers: newAnswers,
    }).eq('id', session.id);

    setIsSubmitting(false);
  };

  const handleNext = async () => {
    if (currentQIndex < totalQuestions - 1) {
      setCurrentQIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowExplanation(false);
      setTimeLeft(120);

      await supabase.from('adaptive_learning_sessions').update({
        current_question_index: currentQIndex + 1,
      }).eq('id', session.id);
    } else {
      // Complete session
      await supabase.from('adaptive_learning_sessions').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', session.id);

      queryClient.invalidateQueries({ queryKey: ['adaptive-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['skill-levels'] });
      toast.success('Session completed! Your skills have been updated.');
      onComplete();
    }
  };

  if (!currentQuestion) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Adaptive Practice</h2>
            <p className="text-sm text-muted-foreground">Question {currentQIndex + 1} of {totalQuestions}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            timeLeft < 20 ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 'bg-muted'
          }`}>
            <Timer className="w-4 h-4" />
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-2">
            <CardContent className="p-6 space-y-6">
              {/* Question text */}
              <div className="text-lg font-medium leading-relaxed">
                <span className="text-primary font-bold mr-2">Q{currentQIndex + 1}.</span>
                <div dangerouslySetInnerHTML={{ __html: currentQuestion.question_text }} />
              </div>

              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((option: string, idx: number) => {
                  let optionClass = 'border-2 hover:border-primary/50 hover:bg-primary/5';
                  if (showExplanation) {
                    if (idx === currentQuestion.correct_option_index) {
                      optionClass = 'border-2 border-green-500 bg-green-50 dark:bg-green-900/20';
                    } else if (idx === selectedOption) {
                      optionClass = 'border-2 border-red-500 bg-red-50 dark:bg-red-900/20';
                    } else {
                      optionClass = 'border-2 opacity-50';
                    }
                  } else if (selectedOption === idx) {
                    optionClass = 'border-2 border-primary bg-primary/10';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(idx)}
                      disabled={showExplanation}
                      className={`w-full text-left p-4 rounded-xl transition-all duration-200 ${optionClass}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                          showExplanation && idx === currentQuestion.correct_option_index
                            ? 'bg-green-500 text-white'
                            : showExplanation && idx === selectedOption
                            ? 'bg-red-500 text-white'
                            : selectedOption === idx
                            ? 'bg-primary text-white'
                            : 'bg-muted'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <div className="flex-1" dangerouslySetInnerHTML={{ __html: option }} />
                        {showExplanation && idx === currentQuestion.correct_option_index && (
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                        {showExplanation && idx === selectedOption && idx !== currentQuestion.correct_option_index && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {showExplanation && currentQuestion.explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4"
                >
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Explanation</p>
                      <div className="text-sm text-blue-600 dark:text-blue-400" dangerouslySetInnerHTML={{ __html: currentQuestion.explanation }} />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Action Button */}
              <div className="flex justify-end">
                {!showExplanation ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={selectedOption === null || isSubmitting}
                    className="min-w-[140px]"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                  </Button>
                ) : (
                  <Button onClick={handleNext} className="min-w-[140px]">
                    {currentQIndex < totalQuestions - 1 ? (
                      <>Next Question <ArrowRight className="w-4 h-4 ml-2" /></>
                    ) : (
                      <>Finish Session <Trophy className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Main Adaptive Learning Page ───
const AdaptiveLearning = () => {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSession, setActiveSession] = useState<AdaptiveSession | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<'chapter' | 'subject' | 'mixed'>('chapter');

  // Fetch skill levels
  const { data: skillLevels, isLoading: skillsLoading } = useQuery({
    queryKey: ['skill-levels', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_skill_levels')
        .select(`
          *,
          chapters:chapter_id(name),
          subjects:subject_id(name)
        `)
        .eq('user_id', user.id)
        .order('skill_level', { ascending: true });

      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        chapter_name: s.chapters?.name || 'Unknown',
        subject_name: s.subjects?.name || 'Unknown',
      })) as SkillLevel[];
    },
    enabled: !!user && !isGuest,
  });

  // Fetch active sessions
  const { data: activeSessions } = useQuery({
    queryKey: ['adaptive-sessions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('adaptive_learning_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data as AdaptiveSession[];
    },
    enabled: !!user && !isGuest,
  });

  // Fetch learning paths
  const { data: learningPaths } = useQuery({
    queryKey: ['learning-paths'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('learning_paths')
        .select(`
          *,
          subjects:subject_id(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user progress for each path
      const { data: userPaths } = await supabase
        .from('user_learning_paths')
        .select('*')
        .eq('user_id', user?.id);

      const userPathMap = new Map((userPaths || []).map((p: any) => [p.path_id, p]));

      return (data || []).map((p: any) => ({
        ...p,
        subject_name: p.subjects?.name || 'Mixed',
        progress: userPathMap.get(p.id)?.progress_percent || 0,
        current_day: userPathMap.get(p.id)?.current_day || 1,
        status: userPathMap.get(p.id)?.status || null,
      })) as LearningPath[];
    },
    enabled: !!user && !isGuest,
  });

  // Fetch daily plan
  const { data: dailyPlan } = useQuery({
    queryKey: ['daily-plan', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('daily_study_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', new Date().toISOString().split('T')[0])
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as DailyPlan | null;
    },
    enabled: !!user && !isGuest,
  });

  // Start new adaptive session mutation
  const startSessionMutation = useMutation({
    mutationFn: async ({ subjectId, chapterId, mode }: { subjectId: string; chapterId?: string; mode: string }) => {
      if (!user) throw new Error('Not authenticated');

      // Get user's skill level for this chapter
      let skillLevel = 50;
      if (chapterId) {
        const { data: sl } = await supabase
          .from('user_skill_levels')
          .select('skill_level')
          .eq('user_id', user.id)
          .eq('chapter_id', chapterId)
          .single();
        if (sl) skillLevel = sl.skill_level;
      }

      // Determine difficulty buckets based on skill
      const buckets = skillLevel < 40 ? ['easy', 'easy', 'medium'] :
                     skillLevel < 70 ? ['easy', 'medium', 'hard'] :
                     skillLevel < 90 ? ['medium', 'hard', 'expert'] :
                     ['hard', 'expert', 'expert'];

      // Fetch questions
      const { data: questions, error } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_option_index, explanation, images, difficulty')
        .eq('subject_id', subjectId)
        .eq('chapter_id', chapterId || '*')
        .limit(100);

      if (error) throw error;
      if (!questions || questions.length < 5) throw new Error('Not enough questions');

      // Smart selection: mix difficulties based on skill
      const selected: any[] = [];
      const shuffled = [...questions].sort(() => Math.random() - 0.5);

      for (let i = 0; i < 15 && selected.length < 15; i++) {
        const targetDiff = buckets[i % buckets.length];
        const match = shuffled.find(q => {
          const diff = q.difficulty === 'auto_easy' ? 'easy' : 
                      q.difficulty === 'auto_medium' ? 'medium' : 'hard';
          return diff === targetDiff && !selected.includes(q);
        });
        if (match) selected.push(match);
        else {
          const fallback = shuffled.find(q => !selected.includes(q));
          if (fallback) selected.push(fallback);
        }
      }

      const { data: session, error: sessionError } = await supabase
        .from('adaptive_learning_sessions')
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          chapter_id: chapterId || null,
          mode,
          questions: selected,
          target_skill_level: Math.min(skillLevel + 10, 100),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      return session;
    },
    onSuccess: (session) => {
      setActiveSession(session);
      setShowStartDialog(false);
      toast.success('Adaptive session started!');
      queryClient.invalidateQueries({ queryKey: ['adaptive-sessions'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start session');
    },
  });

  // Resume session
  const handleResumeSession = (session: AdaptiveSession) => {
    setActiveSession(session);
  };

  // Calculate overall stats
  const overallStats = {
    avgSkill: skillLevels?.length ? Math.round(skillLevels.reduce((a, b) => a + b.skill_level, 0) / skillLevels.length) : 0,
    totalAttempted: skillLevels?.reduce((a, b) => a + b.questions_attempted, 0) || 0,
    totalCorrect: skillLevels?.reduce((a, b) => a + b.questions_correct, 0) || 0,
    weakChapters: skillLevels?.filter(s => s.skill_level < 50).length || 0,
    strongChapters: skillLevels?.filter(s => s.skill_level >= 80).length || 0,
  };

  const accuracy = overallStats.totalAttempted > 0 
    ? Math.round((overallStats.totalCorrect / overallStats.totalAttempted) * 100) 
    : 0;

  // Subjects data
  const subjects = [
    { id: 'physics', name: 'Physics', icon: '⚛️', color: 'from-blue-500 to-indigo-600' },
    { id: 'chemistry', name: 'Chemistry', icon: '🧪', color: 'from-emerald-500 to-teal-600' },
    { id: 'biology', name: 'Biology', icon: '🧬', color: 'from-green-500 to-emerald-600' },
  ];

  if (activeSession) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <ActiveAdaptiveSession 
            session={activeSession} 
            onComplete={() => setActiveSession(null)} 
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Brain className="w-8 h-8 text-primary" />
              Adaptive Learning
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-powered practice that adapts to your skill level in real-time
            </p>
          </div>
          <Button onClick={() => setShowStartDialog(true)} size="lg" className="gap-2">
            <Zap className="w-4 h-4" />
            Start Adaptive Session
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overallStats.avgSkill}%</p>
                  <p className="text-xs text-muted-foreground">Avg Skill Level</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{accuracy}%</p>
                  <p className="text-xs text-muted-foreground">Accuracy</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overallStats.weakChapters}</p>
                  <p className="text-xs text-muted-foreground">Weak Areas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overallStats.strongChapters}</p>
                  <p className="text-xs text-muted-foreground">Mastered</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="skills">Skill Map</TabsTrigger>
            <TabsTrigger value="paths">Learning Paths</TabsTrigger>
            <TabsTrigger value="plan">Daily Plan</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Active Sessions */}
            {activeSessions && activeSessions.length > 0 && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-primary" />
                    Resume Session
                  </CardTitle>
                  <CardDescription>You have an active adaptive session</CardDescription>
                </CardHeader>
                <CardContent>
                  {activeSessions.map(session => (
                    <div key={session.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Adaptive Practice Session</p>
                        <p className="text-sm text-muted-foreground">
                          Question {session.current_question_index + 1} of {session.questions.length}
                        </p>
                      </div>
                      <Button onClick={() => handleResumeSession(session)}>
                        <Play className="w-4 h-4 mr-2" />
                        Resume
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Quick Start Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {subjects.map(subject => {
                const subjectSkills = skillLevels?.filter(s => 
                  s.subject_name.toLowerCase() === subject.name.toLowerCase()
                ) || [];
                const avgSkill = subjectSkills.length 
                  ? Math.round(subjectSkills.reduce((a, b) => a + b.skill_level, 0) / subjectSkills.length) 
                  : 0;
                const weakCount = subjectSkills.filter(s => s.skill_level < 50).length;

                return (
                  <Card key={subject.id} className="group cursor-pointer hover:shadow-lg transition-all"
                    onClick={() => {
                      setSelectedSubject(subject.id);
                      setSelectedMode('subject');
                      setShowStartDialog(true);
                    }}
                  >
                    <CardContent className="p-6">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${subject.color} flex items-center justify-center text-2xl mb-4`}>
                        {subject.icon}
                      </div>
                      <h3 className="text-lg font-bold mb-1">{subject.name}</h3>
                      <div className="flex items-center gap-2 mb-3">
                        <Progress value={avgSkill} className="h-2 flex-1" />
                        <span className="text-sm font-medium">{avgSkill}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{subjectSkills.length} chapters tracked</span>
                        {weakCount > 0 && (
                          <Badge variant="destructive" className="text-xs">{weakCount} weak</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Weak Chapters Alert */}
            {skillLevels && skillLevels.filter(s => s.skill_level < 40).length > 0 && (
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <Flame className="w-5 h-5" />
                    Focus Areas
                  </CardTitle>
                  <CardDescription>These chapters need your attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {skillLevels
                      .filter(s => s.skill_level < 40)
                      .slice(0, 5)
                      .map(skill => (
                        <div key={skill.chapter_id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${getProgressColor(skill.skill_level)}`} />
                            <div>
                              <p className="font-medium text-sm">{skill.chapter_name}</p>
                              <p className="text-xs text-muted-foreground">{skill.subject_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={getSkillColor(skill.skill_level)}>
                              {getSkillLabel(skill.skill_level)}
                            </Badge>
                            <Button size="sm" variant="ghost" onClick={() => {
                              setSelectedSubject(skill.subject_name.toLowerCase());
                              setSelectedChapter(skill.chapter_id);
                              setSelectedMode('chapter');
                              setShowStartDialog(true);
                            }}>
                              Practice
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Skill Map Tab */}
          <TabsContent value="skills" className="space-y-6">
            {skillsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : skillLevels && skillLevels.length > 0 ? (
              <div className="space-y-4">
                {skillLevels.map(skill => (
                  <Card key={skill.chapter_id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{skill.chapter_name}</h4>
                            <Badge variant="secondary" className="text-xs">{skill.subject_name}</Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Progress value={skill.skill_level} className="h-2.5" />
                            </div>
                            <div className="flex items-center gap-3 min-w-[200px]">
                              <span className={`text-sm font-bold ${getSkillColor(skill.skill_level)}`}>
                                {skill.skill_level}%
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {getSkillLabel(skill.skill_level)}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{skill.questions_attempted} attempted</span>
                            <span>{skill.questions_correct} correct</span>
                            {skill.consecutive_correct > 2 && (
                              <span className="text-green-500 flex items-center gap-1">
                                <Flame className="w-3 h-3" /> {skill.consecutive_correct} streak
                              </span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="ml-4" onClick={() => {
                          setSelectedSubject(skill.subject_name.toLowerCase());
                          setSelectedChapter(skill.chapter_id);
                          setSelectedMode('chapter');
                          setShowStartDialog(true);
                        }}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Data Yet</h3>
                <p className="text-muted-foreground mb-4">Start practicing to build your skill map</p>
                <Button onClick={() => setShowStartDialog(true)}>
                  <Play className="w-4 h-4 mr-2" />
                  Start First Session
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* Learning Paths Tab */}
          <TabsContent value="paths" className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {learningPaths?.map(path => (
                <Card key={path.id} className="group hover:shadow-lg transition-all">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{path.subject_name}</Badge>
                      {path.is_premium && (
                        <Badge className="bg-amber-500">
                          <Crown className="w-3 h-3 mr-1" /> Premium
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{path.title}</CardTitle>
                    <CardDescription>{path.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> {path.duration_days} days
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-4 h-4" /> {path.difficulty_level}
                      </span>
                    </div>

                    {path.status ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span className="font-medium">{path.progress}%</span>
                        </div>
                        <Progress value={path.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">Day {path.current_day} of {path.duration_days}</p>
                        <Button className="w-full" variant={path.progress >= 100 ? "outline" : "default"}
                          onClick={() => navigate(`/adaptive/path/${path.id}`)}>
                          {path.progress >= 100 ? 'Completed' : 'Continue'}
                        </Button>
                      </div>
                    ) : (
                      <Button className="w-full" onClick={() => {
                        // Enroll in path
                        toast.success('Enrolled in learning path!');
                      }}>
                        Start Path
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )) || (
                <div className="col-span-full text-center py-12">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No learning paths available yet</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Daily Plan Tab */}
          <TabsContent value="plan" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Today's Study Plan
                </CardTitle>
                <CardDescription>
                  {dailyPlan ? `${dailyPlan.completed_count}/${dailyPlan.total_tasks} tasks completed` : 'Generate your personalized daily plan'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dailyPlan && dailyPlan.plan.length > 0 ? (
                  <div className="space-y-3">
                    {dailyPlan.plan.map((task: any, idx: number) => {
                      const isCompleted = dailyPlan.completed_tasks.some((t: any) => t.id === task.id || t.type === task.type);
                      return (
                        <div key={idx} className={`flex items-center gap-4 p-4 rounded-xl border ${
                          isCompleted ? 'bg-green-50 dark:bg-green-900/20 border-green-200' : 'bg-card'
                        }`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isCompleted ? 'bg-green-500 text-white' : 'bg-primary/10'
                          }`}>
                            {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{task.title || task.chapter_name || 'Study Task'}</p>
                            <p className="text-sm text-muted-foreground">{task.description || `${task.target_questions} questions • ~${task.estimated_time} min`}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {task.estimated_time}m
                            </Badge>
                            {!isCompleted && (
                              <Button size="sm" onClick={() => {
                                if (task.type === 'adaptive_practice') {
                                  setSelectedSubject(task.subject_name?.toLowerCase());
                                  setSelectedChapter(task.chapter_id);
                                  setSelectedMode('chapter');
                                  setShowStartDialog(true);
                                }
                              }}>
                                Start
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No plan generated for today</p>
                    <Button onClick={async () => {
                      if (!user) return;
                      const { data } = await supabase.rpc('generate_daily_plan', { p_user_id: user.id });
                      if (data) {
                        await supabase.from('daily_study_plans').upsert({
                          user_id: user.id,
                          date: new Date().toISOString().split('T')[0],
                          plan: data,
                          total_tasks: data.length,
                        });
                        queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
                        toast.success('Daily plan generated!');
                      }
                    }}>
                      <Zap className="w-4 h-4 mr-2" />
                      Generate Plan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Start Session Dialog */}
        {showStartDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl p-6 max-w-md w-full space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Start Adaptive Session</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowStartDialog(false)}>✕</Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['chapter', 'subject', 'mixed'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setSelectedMode(mode)}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          selectedMode === mode ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/30'
                        }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Subject</label>
                  <div className="grid grid-cols-3 gap-2">
                    {subjects.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSubject(sub.id)}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          selectedSubject === sub.id ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/30'
                        }`}
                      >
                        {sub.icon} {sub.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    The AI will select questions based on your current skill level
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  disabled={!selectedSubject || startSessionMutation.isPending}
                  onClick={() => startSessionMutation.mutate({
                    subjectId: selectedSubject,
                    chapterId: selectedChapter,
                    mode: selectedMode,
                  })}
                >
                  {startSessionMutation.isPending ? 'Starting...' : (
                    <><Zap className="w-4 h-4 mr-2" /> Start Session</>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdaptiveLearning;
