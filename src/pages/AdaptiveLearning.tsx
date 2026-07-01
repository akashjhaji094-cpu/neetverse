// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useMathJax } from '@/hooks/useMathJax';
import { SafeImage, ImageGrid } from '@/components/SafeImage';
import { selectAdaptiveQuestions, updateSkillLevel, SelectedQuestion } from '@/lib/adaptiveEngine';
import {
  Brain, Target, TrendingUp, Zap, BookOpen, Trophy, Clock, ChevronRight,
  Star, Flame, BarChart3, RotateCcw, Play, Lock, Crown, ArrowRight,
  CheckCircle2, XCircle, HelpCircle, Timer, Calendar, AlertTriangle,
  Sparkles, TrendingDown, Award, Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───
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
  avg_response_time: number;
  weak_concepts: string[];
  strong_concepts: string[];
}

interface AdaptiveSession {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  mode: 'chapter' | 'subject' | 'mixed';
  target_skill_level: number;
  current_question_index: number;
  questions: SelectedQuestion[];
  answers: Record<string, SessionAnswer>;
  status: 'active' | 'completed' | 'abandoned';
  started_at: string;
  completed_at?: string;
}

interface SessionAnswer {
  option_index: number;
  is_correct: boolean;
  time_taken: number;
  answered_at: string;
}

interface Subject {
  id: string;
  name: string;
  slug: string;
}

interface Chapter {
  id: string;
  name: string;
  subject_id: string;
  slug: string;
}

// ─── Helpers ───
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

// ─── Session Analysis Component ───
const SessionAnalysis = ({ 
  session, 
  onClose 
}: { 
  session: AdaptiveSession; 
  onClose: () => void;
}) => {
  const answers = Object.values(session.answers);
  const correct = answers.filter(a => a.is_correct).length;
  const accuracy = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;
  const avgTime = answers.length > 0 
    ? Math.round(answers.reduce((a, b) => a + b.time_taken, 0) / answers.length) 
    : 0;
  
  const xpGained = correct * 10 + (accuracy > 80 ? 50 : 0);
  const coinsGained = correct * 5;

  const weakTopics = session.questions
    .filter((q) => !answers[q.question.id]?.is_correct)
    .map(q => q.question.concept_tags || [])
    .flat()
    .filter(Boolean);

  const strongTopics = session.questions
    .filter((q) => answers[q.question.id]?.is_correct)
    .map(q => q.question.concept_tags || [])
    .flat()
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div className="text-center space-y-2">
        <Trophy className="w-16 h-16 mx-auto text-yellow-500" />
        <h2 className="text-3xl font-bold">Session Complete!</h2>
        <p className="text-muted-foreground">Here is how you performed</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-500">{accuracy}%</p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">{avgTime}s</p>
            <p className="text-xs text-muted-foreground">Avg Time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-purple-500">+{xpGained}</p>
            <p className="text-xs text-muted-foreground">XP Gained</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-yellow-500">+{coinsGained}</p>
            <p className="text-xs text-muted-foreground">Coins</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            Weak Areas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weakTopics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {[...new Set(weakTopics)].slice(0, 8).map(topic => (
                <Badge key={topic} variant="destructive">{topic}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No weak areas - great job!</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Strong Areas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {strongTopics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {[...new Set(strongTopics)].slice(0, 8).map(topic => (
                <Badge key={topic} variant="default" className="bg-green-500">{topic}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Keep practicing to build strengths!</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-center">
        <Button onClick={onClose} variant="outline">
          <RotateCcw className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <Button onClick={() => window.location.reload()}>
          <Play className="w-4 h-4 mr-2" />
          New Session
        </Button>
      </div>
    </motion.div>
  );
};

// ─── Active Adaptive Session Component ───
const ActiveAdaptiveSession = ({ 
  session, 
  onComplete 
}: { 
  session: AdaptiveSession; 
  onComplete: (updated: AdaptiveSession) => void;
}) => {
  const [currentQIndex, setCurrentQIndex] = useState(session.current_question_index);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [answers, setAnswers] = useState<Record<string, SessionAnswer>>(session.answers || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { ref: mathRef, mathReady } = useMathJax([currentQIndex, showExplanation]);

  const currentQ = session.questions[currentQIndex];
  const totalQuestions = session.questions.length;
  const progress = ((currentQIndex) / totalQuestions) * 100;

  // Timer effect
  useEffect(() => {
    if (timeLeft > 0 && !showExplanation) {
      const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !showExplanation) {
      handleSubmit(); // Auto-submit on timeout
    }
  }, [timeLeft, showExplanation]);

  const handleOptionSelect = (index: number) => {
    if (showExplanation) return;
    setSelectedOption(index);
  };

  const handleSubmit = async () => {
    if (selectedOption === null && timeLeft > 0) {
      toast.error('Please select an answer');
      return;
    }
    setIsSubmitting(true);

    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);
    const isCorrect = selectedOption === currentQ.question.correct_option_index;
    
    const newAnswer: SessionAnswer = {
      option_index: selectedOption ?? -1,
      is_correct: isCorrect,
      time_taken: Math.min(timeTaken, 120),
      answered_at: new Date().toISOString(),
    };

    const newAnswers = { ...answers, [currentQ.question.id]: newAnswer };
    setAnswers(newAnswers);
    setShowExplanation(true);

    // Update skill level in background
    if (user) {
      updateSkillLevel(
        user.id,
        currentQ.question.chapter_id,
        isCorrect,
        timeTaken,
        currentQ.question.difficulty,
        currentQ.question.concept_tags
      ).catch(console.error);
    }

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
      setQuestionStartTime(Date.now());

      await supabase.from('adaptive_learning_sessions').update({
        current_question_index: currentQIndex + 1,
      }).eq('id', session.id);
    } else {
      const completedSession = {
        ...session,
        status: 'completed' as const,
        completed_at: new Date().toISOString(),
        answers,
        current_question_index: currentQIndex,
      };
      
      await supabase.from('adaptive_learning_sessions').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        current_question_index: currentQIndex,
        answers,
      }).eq('id', session.id);

      queryClient.invalidateQueries({ queryKey: ['adaptive-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['skill-levels'] });
      toast.success('Session completed!');
      onComplete(completedSession);
    }
  };

  if (!currentQ) return null;

  // Parse options safely
  let options: string[] = [];
  try {
    if (Array.isArray(currentQ.question.options)) {
      options = currentQ.question.options;
    } else if (typeof currentQ.question.options === 'string') {
      options = JSON.parse(currentQ.question.options);
    }
  } catch {
    options = ['Option A', 'Option B', 'Option C', 'Option D'];
  }

  const images = currentQ.question.images 
    ? (Array.isArray(currentQ.question.images) 
        ? currentQ.question.images 
        : JSON.parse(currentQ.question.images as unknown as string))
    : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6" ref={mathRef}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Adaptive Practice</h2>
            <p className="text-sm text-muted-foreground">
              Question {currentQIndex + 1} of {totalQuestions}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            {currentQ.selectionReason}
          </Badge>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            timeLeft < 20 ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 'bg-muted'
          }`}>
            <Timer className="w-4 h-4" />
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

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
              <div className="text-lg font-medium leading-relaxed">
                <span className="text-primary font-bold mr-2">Q{currentQIndex + 1}.</span>
                <span dangerouslySetInnerHTML={{ __html: currentQ.question.question_text || '' }} />
              </div>

              {images.length > 0 && (
                <ImageGrid images={images} alt={`Question ${currentQIndex + 1}`} />
              )}

              <div className="space-y-3">
                {options.map((option: string, idx: number) => {
                  let optionClass = 'border-2 hover:border-primary/50 hover:bg-primary/5';
                  if (showExplanation) {
                    if (idx === currentQ.question.correct_option_index) {
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
                          showExplanation && idx === currentQ.question.correct_option_index
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
                        {showExplanation && idx === currentQ.question.correct_option_index && (
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                        {showExplanation && idx === selectedOption && idx !== currentQ.question.correct_option_index && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {showExplanation && currentQ.question.explanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4"
                >
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Explanation</p>
                      <div className="text-sm text-blue-600 dark:text-blue-400" 
                        dangerouslySetInnerHTML={{ __html: currentQ.question.explanation }} />
                    </div>
                  </div>
                </motion.div>
              )}

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
  const [completedSession, setCompletedSession] = useState<AdaptiveSession | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<'chapter' | 'subject' | 'mixed'>('chapter');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  // Redirect guests
  useEffect(() => {
    if (isGuest) {
      toast.error('Please sign in to use Adaptive Learning');
      navigate('/auth');
    }
  }, [isGuest, navigate]);

  // Fetch subjects
  const { data: dbSubjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('id, name, slug').order('name');
      if (error) throw error;
      return (data || []) as Subject[];
    },
  });

  useEffect(() => {
    if (dbSubjects) setSubjects(dbSubjects);
  }, [dbSubjects]);

  // Fetch chapters
  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      return;
    }
    const fetchChapters = async () => {
      setChaptersLoading(true);
      const { data, error } = await supabase
        .from('chapters')
        .select('id, name, subject_id, slug')
        .eq('subject_id', selectedSubject)
        .order('name');
      if (!error) setChapters(data || []);
      setChaptersLoading(false);
    };
    fetchChapters();
  }, [selectedSubject]);

  // Fetch skill levels
  const { data: skillLevels, isLoading: skillsLoading } = useQuery({
    queryKey: ['skill-levels', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_skill_levels')
        .select(`
          *,
          chapters:chapter_id(name, subject_id),
          subjects:subject_id(name)
        `)
        .eq('user_id', user.id)
        .order('skill_level', { ascending: true });

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
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

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data as AdaptiveSession[];
    },
    enabled: !!user && !isGuest,
  });

  // Start new session mutation
  const startSessionMutation = useMutation({
    mutationFn: async ({ subjectId, chapterId, mode }: { subjectId: string; chapterId?: string; mode: string }) => {
      if (!user) throw new Error('Not authenticated');

      const selected = await selectAdaptiveQuestions({
        userId: user.id,
        subjectId,
        chapterId,
        mode: mode as any,
        targetQuestionCount: 15,
      });

      const { data: session, error: sessionError } = await supabase
        .from('adaptive_learning_sessions')
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          chapter_id: chapterId || null,
          mode,
          questions: selected,
          target_skill_level: 50,
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

  const handleResumeSession = (session: AdaptiveSession) => {
    setActiveSession(session);
  };

  const handleSessionComplete = (session: AdaptiveSession) => {
    setActiveSession(null);
    setCompletedSession(session);
  };

  const overallStats = useMemo(() => ({
    avgSkill: skillLevels?.length ? Math.round(skillLevels.reduce((a, b) => a + b.skill_level, 0) / skillLevels.length) : 0,
    totalAttempted: skillLevels?.reduce((a, b) => a + b.questions_attempted, 0) || 0,
    totalCorrect: skillLevels?.reduce((a, b) => a + b.questions_correct, 0) || 0,
    weakChapters: skillLevels?.filter(s => s.skill_level < 50).length || 0,
    strongChapters: skillLevels?.filter(s => s.skill_level >= 80).length || 0,
  }), [skillLevels]);

  const accuracy = overallStats.totalAttempted > 0 
    ? Math.round((overallStats.totalCorrect / overallStats.totalAttempted) * 100) 
    : 0;

  if (completedSession) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <SessionAnalysis 
            session={completedSession} 
            onClose={() => setCompletedSession(null)} 
          />
        </div>
      </DashboardLayout>
    );
  }

  if (activeSession) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <ActiveAdaptiveSession 
            session={activeSession} 
            onComplete={handleSessionComplete} 
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <Brain className="w-7 h-7 md:w-8 md:h-8 text-primary" />
              Adaptive Learning
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              AI-powered practice that adapts to your skill level
            </p>
          </div>
          <Button onClick={() => setShowStartDialog(true)} size="lg" className="gap-2 w-full md:w-auto">
            <Zap className="w-4 h-4" />
            Start Adaptive Session
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { icon: Target, label: 'Avg Skill', value: `${overallStats.avgSkill}%`, color: 'text-primary' },
            { icon: TrendingUp, label: 'Accuracy', value: `${accuracy}%`, color: 'text-green-500' },
            { icon: BookOpen, label: 'Weak Areas', value: overallStats.weakChapters, color: 'text-red-500' },
            { icon: Trophy, label: 'Mastered', value: overallStats.strongChapters, color: 'text-purple-500' },
          ].map((stat, idx) => (
            <Card key={idx}>
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center`}>
                    <stat.icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-lg md:text-2xl font-bold">{stat.value}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="skills">Skill Map</TabsTrigger>
            <TabsTrigger value="plan">Daily Plan</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 md:space-y-6">
            {activeSessions && activeSessions.length > 0 && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                    <RotateCcw className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    Resume Session
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activeSessions.map(session => (
                    <div key={session.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Adaptive Practice Session</p>
                        <p className="text-xs text-muted-foreground">
                          Question {session.current_question_index + 1} of {session.questions.length}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => handleResumeSession(session)}>
                        <Play className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                        Resume
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Subject Cards */}
            {subjectsLoading ? (
              <div className="grid md:grid-cols-3 gap-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-3 md:gap-4">
                {subjects.map((subject, idx) => {
                  const colors = [
                    'from-blue-500 to-indigo-600',
                    'from-emerald-500 to-teal-600', 
                    'from-green-500 to-emerald-600'
                  ];
                  const subjectSkills = skillLevels?.filter(s => 
                    s.subject_name?.toLowerCase() === subject.name.toLowerCase()
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
                      <CardContent className="p-4 md:p-6">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br ${colors[idx % colors.length]} flex items-center justify-center text-xl md:text-2xl mb-3 md:mb-4`}>
                          {['⚛️', '🧪', '🧬'][idx % 3]}
                        </div>
                        <h3 className="text-base md:text-lg font-bold mb-1">{subject.name}</h3>
                        <div className="flex items-center gap-2 mb-2 md:mb-3">
                          <Progress value={avgSkill} className="h-2 flex-1" />
                          <span className="text-sm font-medium">{avgSkill}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs md:text-sm">
                          <span className="text-muted-foreground">{subjectSkills.length} chapters</span>
                          {weakCount > 0 && (
                            <Badge variant="destructive" className="text-[10px] md:text-xs">{weakCount} weak</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Weak Chapters Alert */}
            {skillLevels && skillLevels.filter(s => s.skill_level < 40).length > 0 && (
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300 text-sm md:text-base">
                    <Flame className="w-4 h-4 md:w-5 md:h-5" />
                    Focus Areas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 md:space-y-3">
                    {skillLevels
                      .filter(s => s.skill_level < 40)
                      .slice(0, 5)
                      .map(skill => (
                        <div key={skill.chapter_id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 md:gap-3 min-w-0">
                            <div className={`w-2 h-2 rounded-full ${getProgressColor(skill.skill_level)} flex-shrink-0`} />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{skill.chapter_name}</p>
                              <p className="text-[10px] md:text-xs text-muted-foreground">{skill.subject_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                            <Badge variant="outline" className={`text-[10px] md:text-xs ${getSkillColor(skill.skill_level)}`}>
                              {getSkillLabel(skill.skill_level)}
                            </Badge>
                            <Button size="sm" variant="ghost" className="h-7 md:h-8 px-2" onClick={() => {
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
          <TabsContent value="skills" className="space-y-4 md:space-y-6">
            {skillsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : skillLevels && skillLevels.length > 0 ? (
              <div className="space-y-3 md:space-y-4">
                {skillLevels.map(skill => (
                  <Card key={skill.chapter_id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-sm md:text-base truncate">{skill.chapter_name}</h4>
                            <Badge variant="secondary" className="text-[10px] md:text-xs flex-shrink-0">{skill.subject_name}</Badge>
                          </div>
                          <div className="flex items-center gap-2 md:gap-4">
                            <div className="flex-1">
                              <Progress value={skill.skill_level} className="h-2 md:h-2.5" />
                            </div>
                            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                              <span className={`text-sm md:text-base font-bold ${getSkillColor(skill.skill_level)}`}>
                                {skill.skill_level}%
                              </span>
                              <Badge variant="outline" className="text-[10px] md:text-xs">
                                {getSkillLabel(skill.skill_level)}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 md:gap-4 mt-1 md:mt-2 text-[10px] md:text-xs text-muted-foreground">
                            <span>{skill.questions_attempted} attempted</span>
                            <span>{skill.questions_correct} correct</span>
                            {skill.consecutive_correct > 2 && (
                              <span className="text-green-500 flex items-center gap-1">
                                <Flame className="w-2.5 h-2.5 md:w-3 md:h-3" /> {skill.consecutive_correct} streak
                              </span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="flex-shrink-0 h-8 w-8 p-0" onClick={() => {
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
              <Card className="p-8 md:p-12 text-center">
                <Brain className="w-10 h-10 md:w-12 md:h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-base md:text-lg font-medium mb-2">No Data Yet</h3>
                <p className="text-muted-foreground mb-4 text-sm">Start practicing to build your skill map</p>
                <Button onClick={() => setShowStartDialog(true)} size="sm">
                  <Play className="w-4 h-4 mr-2" />
                  Start First Session
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* Daily Plan Tab */}
          <TabsContent value="plan" className="space-y-4 md:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  Today&apos;s Study Plan
                </CardTitle>
                <CardDescription>
                  Personalized daily study recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Daily plan feature coming soon!</p>
                  <Button onClick={() => toast.info('Daily plan generation will be available soon!')}>
                    <Zap className="w-4 h-4 mr-2" />
                    Generate Plan
                  </Button>
                </div>
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
              className="bg-card border rounded-2xl p-6 max-w-md w-full space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Start Adaptive Session</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowStartDialog(false)}>✕</Button>
              </div>

              <div className="space-y-4">
                {/* Mode Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['chapter', 'subject', 'mixed'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => {
                          setSelectedMode(mode);
                          if (mode === 'mixed') setSelectedChapter('');
                        }}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        selectedMode === mode ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/30'
                        }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Subject *</label>
                  {subjectsLoading ? (
                    <Skeleton className="h-10" />
                  ) : (
                    <select
                      value={selectedSubject}
                      onChange={(e) => {
                        setSelectedSubject(e.target.value);
                        setSelectedChapter('');
                      }}
                      className="w-full p-3 rounded-xl border-2 bg-background text-sm"
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Chapter Selection (only for chapter mode) */}
                {selectedMode === 'chapter' && selectedSubject && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Chapter *</label>
                    {chaptersLoading ? (
                      <Skeleton className="h-10" />
                    ) : chapters.length > 0 ? (
                      <select
                        value={selectedChapter}
                        onChange={(e) => setSelectedChapter(e.target.value)}
                        className="w-full p-3 rounded-xl border-2 bg-background text-sm"
                      >
                        <option value="">Select Chapter</option>
                        {chapters.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 rounded-xl border-2 border-dashed border-muted text-sm text-muted-foreground text-center">
                        No chapters found for this subject
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    The AI will select 15 questions based on your current skill level
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  disabled={!selectedSubject || startSessionMutation.isPending || (selectedMode === 'chapter' && !selectedChapter)}
                  onClick={() => startSessionMutation.mutate({
                    subjectId: selectedSubject,
                    chapterId: selectedMode === 'chapter' ? selectedChapter : undefined,
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
