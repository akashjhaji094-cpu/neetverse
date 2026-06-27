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
  Timer,
  Calendar,
  AlertTriangle
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

  // Parse options safely
  let options: string[] = [];
  try {
    if (Array.isArray(currentQuestion.options)) {
      options = currentQuestion.options;
    } else if (typeof currentQuestion.options === 'string') {
      options = JSON.parse(currentQuestion.options);
    }
  } catch {
    options = ['Option A', 'Option B', 'Option C', 'Option D'];
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
                <span dangerouslySetInnerHTML={{ __html: currentQuestion.question_text || '' }} />
              </div>

              <div className="space-y-3">
                {options.map((option: string, idx: number) => {
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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  // Fetch subjects from DB
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

  // Fetch chapters when subject changes
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
          chapters:chapter_id(name),
          subjects:subject_id(name)
        `)
        .eq('user_id', user.id)
        .order('skill_level', { ascending: true });

      if (error) {
        // Table might not exist, return empty
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

  // Start new adaptive session mutation
  const startSessionMutation = useMutation({
    mutationFn: async ({ subjectId, chapterId, mode }: { subjectId: string; chapterId?: string; mode: string }) => {
      if (!user) throw new Error('Not authenticated');

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

      const buckets = skillLevel < 40 ? ['auto_easy', 'auto_easy', 'auto_medium'] :
                     skillLevel < 70 ? ['auto_easy', 'auto_medium', 'auto_hard'] :
                     skillLevel < 90 ? ['auto_medium', 'auto_hard', 'auto_hard'] :
                     ['auto_hard', 'auto_hard', 'auto_hard'];

      // Build query
      let query = supabase
        .from('questions')
        .select('id, question_text, options, correct_option_index, explanation, images, difficulty, chapter_id, subject_id')
        .eq('subject_id', subjectId)
        .limit(200);

      if (chapterId) {
        query = query.eq('chapter_id', chapterId);
      }

      const { data: questions, error } = await query;

      if (error) throw error;
      if (!questions || questions.length < 5) {
        throw new Error(`Only ${questions?.length || 0} questions found. Need at least 5.`);
      }

      // Smart selection based on difficulty
      const selected: any[] = [];
      const shuffled = [...questions].sort(() => Math.random() - 0.5);

      for (let i = 0; i < 15 && selected.length < 15; i++) {
        const targetDiff = buckets[i % buckets.length];
        const match = shuffled.find(q => q.difficulty === targetDiff && !selected.includes(q));
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

  const handleResumeSession = (session: AdaptiveSession) => {
    setActiveSession(session);
  };

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="skills">Skill Map</TabsTrigger>
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

            {/* Quick Start Cards - Dynamic from DB */}
            {subjectsLoading ? (
              <div className="grid md:grid-cols-3 gap-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                {subjects.map((subject, idx) => {
                  const colors = [
                    'from-blue-500 to-indigo-600',
                    'from-emerald-500 to-teal-600', 
                    'from-green-500 to-emerald-600'
                  ];
                  const icons = ['⚛️', '🧪', '🧬'];
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
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors[idx % colors.length]} flex items-center justify-center text-2xl mb-4`}>
                          {icons[idx % icons.length]}
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
            )}

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

          {/* Daily Plan Tab */}
          <TabsContent value="plan" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Today's Study Plan
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
