import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Swords,
  Users,
  Trophy,
  Crown,
  Zap,
  Timer,
  ArrowRight,
  Copy,
  CheckCircle2,
  XCircle,
  Star,
  Flame,
  Shield,
  Sword,
  Gem,
  Medal,
  Radio,
  UserPlus,
  LogOut,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Target,
  TrendingUp,
  Clock,
  ChevronRight,
  AlertCircle,
  Wifi,
  WifiOff,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BattleRoom {
  id: string;
  code: string;
  name: string;
  host_id: string;
  subject_id: string | null;
  chapter_id: string | null;
  question_count: number;
  time_per_question: number;
  status: 'waiting' | 'countdown' | 'active' | 'finished';
  max_players: number;
  current_players: number;
  questions: any[];
  current_question_index: number;
  started_at: string | null;
}

interface BattlePlayer {
  id: string;
  user_id: string;
  display_name: string;
  avatar_emoji: string;
  is_ready: boolean;
  is_host: boolean;
  score: number;
  correct_count: number;
  wrong_count: number;
  streak: number;
  max_streak: number;
  is_connected: boolean;
}

interface BattleQuestionState {
  question_index: number;
  status: 'active' | 'revealed' | 'finished';
  ends_at: string;
  player_answers: Record<string, { option_index: number; time_taken_ms: number; is_correct: boolean }>;
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
}

const RANK_TIERS: Record<string, { color: string; icon: string; min: number }> = {
  Bronze: { color: 'from-amber-700 to-amber-600', icon: '🥉', min: 0 },
  Silver: { color: 'from-gray-400 to-gray-300', icon: '🥈', min: 1000 },
  Gold: { color: 'from-yellow-500 to-amber-400', icon: '🥇', min: 1300 },
  Platinum: { color: 'from-cyan-500 to-blue-400', icon: '💎', min: 1600 },
  Diamond: { color: 'from-blue-600 to-indigo-500', icon: '💠', min: 1900 },
  Master: { color: 'from-purple-600 to-pink-500', icon: '👑', min: 2200 },
  Grandmaster: { color: 'from-red-600 to-orange-500', icon: '🔥', min: 2500 },
};

const AVATARS = ['🎓', '🧠', '⚡', '🔥', '🎯', '🚀', '💪', '⭐', '🦁', '🦅', '🐯', '🐉'];

// ─── Live Battle Room Component ───
const LiveBattleRoom = ({ 
  room, 
  players, 
  currentUserId,
  onLeave 
}: { 
  room: BattleRoom; 
  players: BattlePlayer[]; 
  currentUserId: string;
  onLeave: () => void;
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState(room.time_per_question);
  const [questionState, setQuestionState] = useState<BattleQuestionState | null>(null);
  const [finalResults, setFinalResults] = useState<BattlePlayer[] | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  const currentPlayer = players.find(p => p.user_id === currentUserId);
  const isHost = currentPlayer?.is_host || false;

  useEffect(() => {
    const channel = supabase.channel(`battle:${room.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battle_question_states',
        filter: `room_id=eq.${room.id}`
      }, (payload: any) => {
        setQuestionState(payload.new);
        if (payload.new.status === 'active') {
          setCurrentQuestion(payload.new.question_index);
          setSelectedOption(null);
          setHasAnswered(false);
          setShowResults(false);
          setTimeLeft(room.time_per_question);
        } else if (payload.new.status === 'revealed') {
          setShowResults(true);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battle_rooms',
        filter: `id=eq.${room.id}`
      }, (payload: any) => {
        if (payload.new.status === 'finished') {
          setFinalResults(players.sort((a, b) => b.score - a.score));
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [room.id, players, room.time_per_question]);

  useEffect(() => {
    if (room.status === 'active' && timeLeft > 0 && !hasAnswered) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [timeLeft, hasAnswered, room.status]);

  useEffect(() => {
    if (room.status === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, room.status]);

  const handleAnswer = async (optionIndex: number) => {
    if (hasAnswered || showResults) return;
    setSelectedOption(optionIndex);
    setHasAnswered(true);

    const timeTaken = (room.time_per_question - timeLeft) * 1000;

    await supabase.from('battle_question_states').update({
      player_answers: {
        ...(questionState?.player_answers || {}),
        [currentUserId]: {
          option_index: optionIndex,
          time_taken_ms: timeTaken,
          is_correct: null
        }
      }
    }).eq('room_id', room.id).eq('question_index', currentQuestion);
  };

  const handleStartGame = async () => {
    if (!isHost) return;

    const allReady = players.every(p => p.is_ready || p.is_host);
    if (!allReady) {
      toast.error('Not all players are ready!');
      return;
    }

    // Build query based on room settings
    let query = supabase
      .from('questions')
      .select('id, question_text, options, correct_option_index, explanation, images')
      .limit(500);

    if (room.subject_id) {
      query = query.eq('subject_id', room.subject_id);
    }
    if (room.chapter_id) {
      query = query.eq('chapter_id', room.chapter_id);
    }

    const { data: questions, error } = await query;

    if (error || !questions || questions.length < room.question_count) {
      toast.error(`Only ${questions?.length || 0} questions available. Need ${room.question_count}.`);
      return;
    }

    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, room.question_count);

    await supabase.from('battle_rooms').update({
      status: 'countdown',
      questions: shuffled,
    }).eq('id', room.id);

    setTimeout(async () => {
      await supabase.from('battle_rooms').update({
        status: 'active',
        started_at: new Date().toISOString(),
        current_question_index: 0,
      }).eq('id', room.id);

      await supabase.from('battle_question_states').insert({
        room_id: room.id,
        question_index: 0,
        question_id: shuffled[0].id,
        ends_at: new Date(Date.now() + room.time_per_question * 1000).toISOString(),
      });
    }, 3000);
  };

  const handleToggleReady = async () => {
    await supabase.from('battle_players').update({
      is_ready: !currentPlayer?.is_ready
    }).eq('room_id', room.id).eq('user_id', currentUserId);
  };

  // Render countdown screen
  if (room.status === 'countdown') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center space-y-8"
        >
          <h2 className="text-2xl font-bold">Get Ready!</h2>
          <motion.div
            key={countdown}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="text-8xl font-black text-primary"
          >
            {countdown > 0 ? countdown : 'GO!'}
          </motion.div>
          <div className="flex items-center gap-4 justify-center">
            {players.map(p => (
              <div key={p.id} className="text-center">
                <div className="text-3xl mb-1">{p.avatar_emoji}</div>
                <p className="text-sm font-medium">{p.display_name}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // Render final results
  if (finalResults) {
    const myRank = finalResults.findIndex(p => p.user_id === currentUserId) + 1;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <Trophy className="w-16 h-16 mx-auto text-yellow-500" />
          <h2 className="text-3xl font-bold">Battle Complete!</h2>
          <p className="text-xl text-muted-foreground">
            You ranked <span className="font-bold text-primary">#{myRank}</span> out of {finalResults.length}
          </p>
        </motion.div>

        <div className="space-y-3">
          {finalResults.map((player, idx) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className={`${player.user_id === currentUserId ? 'border-primary bg-primary/5' : ''}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="text-2xl font-black w-12 text-center">
                    {idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </div>
                  <div className="text-3xl">{player.avatar_emoji}</div>
                  <div className="flex-1">
                    <p className="font-bold">{player.display_name} {player.user_id === currentUserId && '(You)'}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> {player.correct_count}</span>
                      <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> {player.wrong_count}</span>
                      <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {player.max_streak}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black">{player.score}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          <Button onClick={onLeave} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Leave Room
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Play Again
          </Button>
        </div>
      </div>
    );
  }

  // Render waiting lobby
  if (room.status === 'waiting') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Battle Lobby</CardTitle>
                <CardDescription>Room Code: <span className="font-mono font-bold text-primary">{room.code}</span></CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(room.code);
                toast.success('Room code copied!');
              }}>
                <Copy className="w-4 h-4 mr-1" /> Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {players.map(player => (
                <div key={player.id} className={`p-4 rounded-xl border-2 text-center space-y-2 ${
                  player.is_ready ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-muted'
                }`}>
                  <div className="text-4xl">{player.avatar_emoji}</div>
                  <p className="font-medium text-sm">{player.display_name}</p>
                  {player.is_host && <Badge variant="secondary" className="text-xs">Host</Badge>}
                  {player.is_ready && <Badge className="bg-green-500 text-xs">Ready</Badge>}
                  {!player.is_connected && <Badge variant="destructive" className="text-xs">Offline</Badge>}
                </div>
              ))}
              {Array.from({ length: room.max_players - players.length }).map((_, i) => (
                <div key={`empty-${i}`} className="p-4 rounded-xl border-2 border-dashed border-muted text-center space-y-2 opacity-50">
                  <div className="text-4xl">➕</div>
                  <p className="text-sm text-muted-foreground">Waiting...</p>
                </div>
              ))}
            </div>

            <div className="bg-muted rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Questions</span>
                <span className="font-medium">{room.question_count}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Time per Question</span>
                <span className="font-medium">{room.time_per_question}s</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Max Players</span>
                <span className="font-medium">{room.max_players}</span>
              </div>
            </div>

            <div className="flex gap-3">
              {isHost ? (
                <Button 
                  className="flex-1" 
                  size="lg"
                  onClick={handleStartGame}
                  disabled={players.length < 2}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Battle
                </Button>
              ) : (
                <Button 
                  className="flex-1" 
                  size="lg"
                  variant={currentPlayer?.is_ready ? "outline" : "default"}
                  onClick={handleToggleReady}
                >
                  {currentPlayer?.is_ready ? (
                    <><XCircle className="w-4 h-4 mr-2" /> Not Ready</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Ready</>
                  )}
                </Button>
              )}
              <Button variant="outline" onClick={onLeave}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render active battle
  const question = room.questions[currentQuestion];
  if (!question) return null;

  const progress = ((currentQuestion) / room.question_count) * 100;
  const timerProgress = (timeLeft / room.time_per_question) * 100;

  // Parse options safely
  let options: string[] = [];
  try {
    if (Array.isArray(question.options)) {
      options = question.options;
    } else if (typeof question.options === 'string') {
      options = JSON.parse(question.options);
    }
  } catch {
    options = ['Option A', 'Option B', 'Option C', 'Option D'];
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            Q{currentQuestion + 1}/{room.question_count}
          </Badge>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            {players.filter(p => p.is_connected).length} online
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSoundEnabled(!soundEnabled)}>
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
      </div>

      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${
            timerProgress > 50 ? 'bg-green-500' : timerProgress > 25 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${timerProgress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {players.sort((a, b) => b.score - a.score).map(player => (
          <div key={player.id} className={`flex-shrink-0 px-3 py-2 rounded-xl border ${
            player.user_id === currentUserId ? 'border-primary bg-primary/5' : 'border-muted'
          }`}>
            <div className="flex items-center gap-2">
              <span>{player.avatar_emoji}</span>
              <span className="text-sm font-medium">{player.score}</span>
              {player.streak > 1 && (
                <span className="text-xs text-orange-500">🔥{player.streak}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <Card className="border-2">
            <CardContent className="p-6 space-y-6">
              <div className="text-lg font-medium leading-relaxed">
                <span className="text-primary font-bold mr-2">Q{currentQuestion + 1}.</span>
                <span dangerouslySetInnerHTML={{ __html: question.question_text || '' }} />
              </div>

              <div className="grid gap-3">
                {options.map((option: string, idx: number) => {
                  let btnClass = 'border-2 hover:border-primary/50 hover:bg-primary/5';

                  if (showResults) {
                    if (idx === question.correct_option_index) {
                      btnClass = 'border-2 border-green-500 bg-green-50 dark:bg-green-900/20';
                    } else if (idx === selectedOption) {
                      btnClass = 'border-2 border-red-500 bg-red-50 dark:bg-red-900/20';
                    } else {
                      btnClass = 'border-2 opacity-40';
                    }
                  } else if (selectedOption === idx) {
                    btnClass = 'border-2 border-primary bg-primary/10';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      disabled={hasAnswered || showResults}
                      className={`text-left p-4 rounded-xl transition-all ${btnClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                          showResults && idx === question.correct_option_index
                            ? 'bg-green-500 text-white'
                            : showResults && idx === selectedOption
                            ? 'bg-red-500 text-white'
                            : selectedOption === idx
                            ? 'bg-primary text-white'
                            : 'bg-muted'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <div className="flex-1" dangerouslySetInnerHTML={{ __html: option }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {showResults && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-muted rounded-xl p-4"
                >
                  <h4 className="font-medium mb-2">Results</h4>
                  <div className="space-y-2">
                    {players.sort((a, b) => b.score - a.score).map((player, idx) => {
                      const answer = questionState?.player_answers?.[player.user_id];
                      const isCorrect = answer?.is_correct;

                      return (
                        <div key={player.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span>{player.avatar_emoji}</span>
                            <span>{player.display_name}</span>
                            {isCorrect ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <span className="font-medium">+{isCorrect ? Math.round(100 + (answer?.time_taken_ms < 15000 ? 50 : 0)) : 0}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Main Battle Arena Page ───
const BattleArena = () => {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const [activeTab, setActiveTab] = useState('lobby');
  const [currentRoom, setCurrentRoom] = useState<BattleRoom | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<BattlePlayer[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🎓');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [createSettings, setCreateSettings] = useState({
    name: '',
    subjectId: '',
    chapterId: '',
    questionCount: 10,
    timePerQuestion: 30,
    maxPlayers: 5,
  });

  // Redirect guests
  useEffect(() => {
    if (isGuest) {
      toast.error('Please sign in to use Battle Arena');
      navigate('/auth');
    }
  }, [isGuest, navigate]);

  // Fetch subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      const { data, error } = await supabase.from('subjects').select('id, name, slug').order('name');
      if (!error) setSubjects(data || []);
    };
    fetchSubjects();
  }, []);

  // Fetch chapters when subject changes in create dialog
  useEffect(() => {
    if (!createSettings.subjectId) {
      setChapters([]);
      return;
    }
    const fetchChapters = async () => {
      setChaptersLoading(true);
      const { data, error } = await supabase
        .from('chapters')
        .select('id, name, subject_id')
        .eq('subject_id', createSettings.subjectId)
        .order('name');
      if (!error) setChapters(data || []);
      setChaptersLoading(false);
    };
    fetchChapters();
  }, [createSettings.subjectId]);

  // Fetch leaderboard
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['battle-leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('battle_leaderboard')
        .select('*')
        .order('rating', { ascending: false })
        .limit(50);

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data || [];
    },
  });

  // Fetch user's battle history
  const { data: battleHistory } = useQuery({
    queryKey: ['battle-history', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('battle_history')
        .select('*')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(20);

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch user's rank
  const { data: myRank } = useQuery({
    queryKey: ['my-battle-rank', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('battle_leaderboard')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        if (error.code === '42P01') return null;
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data: room, error } = await supabase
        .from('battle_rooms')
        .insert({
          code,
          host_id: user.id,
          name: createSettings.name || `Battle ${code}`,
          subject_id: createSettings.subjectId || null,
          chapter_id: createSettings.chapterId || null,
          question_count: createSettings.questionCount,
          time_per_question: createSettings.timePerQuestion,
          max_players: createSettings.maxPlayers,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('battle_players').insert({
        room_id: room.id,
        user_id: user.id,
        display_name: displayName || user.user_metadata?.name || 'Player',
        avatar_emoji: selectedAvatar,
        is_host: true,
        is_ready: true,
      });

      return room;
    },
    onSuccess: (room) => {
      setCurrentRoom(room);
      setShowCreateDialog(false);
      toast.success(`Room created! Code: ${room.code}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create room');
    },
  });

  // Join room mutation
  const joinRoomMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data: room, error: roomError } = await supabase
        .from('battle_rooms')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .eq('status', 'waiting')
        .single();

      if (roomError || !room) throw new Error('Room not found or already started');
      if (room.current_players >= room.max_players) throw new Error('Room is full');

      const { data: existing } = await supabase
        .from('battle_players')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single();

      if (!existing) {
        await supabase.from('battle_players').insert({
          room_id: room.id,
          user_id: user.id,
          display_name: displayName || user.user_metadata?.name || 'Player',
          avatar_emoji: selectedAvatar,
        });
      }

      return room;
    },
    onSuccess: (room) => {
      setCurrentRoom(room);
      setShowJoinDialog(false);
      toast.success('Joined room successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to join room');
    },
  });

  // Subscribe to room updates
  useEffect(() => {
    if (!currentRoom) return;

    const channel = supabase.channel(`room:${currentRoom.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battle_players',
        filter: `room_id=eq.${currentRoom.id}`
      }, () => {
        supabase.from('battle_players')
          .select('*')
          .eq('room_id', currentRoom.id)
          .then(({ data }) => {
            if (data) setRoomPlayers(data);
          });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battle_rooms',
        filter: `id=eq.${currentRoom.id}`
      }, (payload: any) => {
        setCurrentRoom(payload.new);
      })
      .subscribe();

    supabase.from('battle_players')
      .select('*')
      .eq('room_id', currentRoom.id)
      .then(({ data }) => {
        if (data) setRoomPlayers(data);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [currentRoom?.id]);

  const handleLeaveRoom = async () => {
    if (!currentRoom || !user) return;

    await supabase.from('battle_players')
      .delete()
      .eq('room_id', currentRoom.id)
      .eq('user_id', user.id);

    setCurrentRoom(null);
    setRoomPlayers([]);
  };

  if (currentRoom) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <LiveBattleRoom
            room={currentRoom}
            players={roomPlayers}
            currentUserId={user?.id || ''}
            onLeave={handleLeaveRoom}
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
              <Swords className="w-8 h-8 text-primary" />
              Battle Arena
            </h1>
            <p className="text-muted-foreground mt-1">
              Compete live with other NEET aspirants in real-time quiz battles
            </p>
          </div>
          {myRank && (
            <Card className="px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{RANK_TIERS[myRank.rank_tier]?.icon || '🥉'}</span>
                <div>
                  <p className="font-bold">{myRank.rank_tier || 'Bronze'}</p>
                  <p className="text-xs text-muted-foreground">{myRank.rating || 0} Rating</p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-all group" onClick={() => setShowCreateDialog(true)}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-2xl">
                <Swords className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold group-hover:text-primary transition-colors">Create Battle</h3>
                <p className="text-sm text-muted-foreground">Host a room and invite friends</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-all group" onClick={() => setShowJoinDialog(true)}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-2xl">
                <UserPlus className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold group-hover:text-green-500 transition-colors">Join Battle</h3>
                <p className="text-sm text-muted-foreground">Enter a room code to compete</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lobby">Active Rooms</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="history">My Battles</TabsTrigger>
          </TabsList>

          <TabsContent value="lobby" className="space-y-4">
            <ActiveRoomsList 
              onJoin={(room) => {
                setCurrentRoom(room);
                toast.success('Joined room!');
              }}
            />
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-4">
            <div className="grid gap-3">
              {leaderboardLoading ? (
                Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16" />)
              ) : leaderboard && leaderboard.length > 0 ? (
                leaderboard.map((entry: any, idx: number) => {
                  const tier = RANK_TIERS[entry.rank_tier] || RANK_TIERS['Bronze'];
                  return (
                    <motion.div
                      key={entry.user_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className={`${entry.user_id === user?.id ? 'border-primary bg-primary/5' : ''}`}>
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="text-xl font-black w-10 text-center">
                            {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}
                          </div>
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center text-lg`}>
                            {tier.icon}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold">{entry.display_name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{entry.total_battles} battles</span>
                              <span>{entry.total_wins} wins</span>
                              <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> {entry.best_streak}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black">{entry.rating}</p>
                            <Badge variant="outline" className="text-xs">{entry.rank_tier}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No battles played yet. Be the first!</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {battleHistory && battleHistory.length > 0 ? (
              <div className="grid gap-3">
                {battleHistory.map((battle: any) => (
                  <Card key={battle.id}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="text-2xl font-black w-12 text-center">
                        {battle.final_rank === 1 ? '👑' : `#${battle.final_rank}`}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{battle.subject_name || 'Mixed Subject'}</p>
                          <Badge variant={battle.rating_change >= 0 ? "default" : "destructive"} className="text-xs">
                            {battle.rating_change >= 0 ? '+' : ''}{battle.rating_change}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> {battle.correct_count}</span>
                          <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> {battle.wrong_count}</span>
                          <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {battle.max_streak}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{battle.score}</p>
                        <p className="text-xs text-muted-foreground">{new Date(battle.played_at).toLocaleDateString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Swords className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No battle history yet. Start your first battle!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Room Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl p-6 max-w-md w-full space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Create Battle Room</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateDialog(false)}>✕</Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Your Name</label>
                  <Input 
                    value={displayName} 
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Enter display name"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Choose Avatar</label>
                  <div className="grid grid-cols-6 gap-2">
                    {AVATARS.map(avatar => (
                      <button
                        key={avatar}
                        onClick={() => setSelectedAvatar(avatar)}
                        className={`text-2xl p-2 rounded-xl border-2 transition-all ${
                          selectedAvatar === avatar ? 'border-primary bg-primary/10' : 'border-transparent hover:border-muted'
                        }`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Room Name</label>
                  <Input 
                    value={createSettings.name} 
                    onChange={e => setCreateSettings(s => ({ ...s, name: e.target.value }))}
                    placeholder="My Battle Room"
                  />
                </div>

                {/* Subject & Chapter Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Subject (Optional)</label>
                  <select
                    value={createSettings.subjectId}
                    onChange={e => setCreateSettings(s => ({ ...s, subjectId: e.target.value, chapterId: '' }))}
                    className="w-full p-3 rounded-xl border-2 bg-background text-sm"
                  >
                    <option value="">All Subjects (Mixed)</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {createSettings.subjectId && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Chapter (Optional)</label>
                    {chaptersLoading ? (
                      <Skeleton className="h-10" />
                    ) : chapters.length > 0 ? (
                      <select
                        value={createSettings.chapterId}
                        onChange={e => setCreateSettings(s => ({ ...s, chapterId: e.target.value }))}
                        className="w-full p-3 rounded-xl border-2 bg-background text-sm"
                      >
                        <option value="">All Chapters</option>
                        {chapters.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 rounded-xl border-2 border-dashed border-muted text-sm text-muted-foreground text-center">
                        No chapters found
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Questions</label>
                    <select 
                      className="w-full p-2 rounded-lg border bg-background"
                      value={createSettings.questionCount}
                      onChange={e => setCreateSettings(s => ({ ...s, questionCount: Number(e.target.value) }))}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Time (sec)</label>
                    <select 
                      className="w-full p-2 rounded-lg border bg-background"
                      value={createSettings.timePerQuestion}
                      onChange={e => setCreateSettings(s => ({ ...s, timePerQuestion: Number(e.target.value) }))}
                    >
                      <option value={15}>15s</option>
                      <option value={30}>30s</option>
                      <option value={45}>45s</option>
                      <option value={60}>60s</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Max Players</label>
                    <select 
                      className="w-full p-2 rounded-lg border bg-background"
                      value={createSettings.maxPlayers}
                      onChange={e => setCreateSettings(s => ({ ...s, maxPlayers: Number(e.target.value) }))}
                    >
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                    </select>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  disabled={!displayName || createRoomMutation.isPending}
                  onClick={() => createRoomMutation.mutate()}
                >
                  {createRoomMutation.isPending ? 'Creating...' : (
                    <><Swords className="w-4 h-4 mr-2" /> Create Room</>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Join Room Dialog */}
        {showJoinDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl p-6 max-w-md w-full space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Join Battle</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowJoinDialog(false)}>✕</Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Your Name</label>
                  <Input 
                    value={displayName} 
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Enter display name"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Choose Avatar</label>
                  <div className="grid grid-cols-6 gap-2">
                    {AVATARS.map(avatar => (
                      <button
                        key={avatar}
                        onClick={() => setSelectedAvatar(avatar)}
                        className={`text-2xl p-2 rounded-xl border-2 transition-all ${
                          selectedAvatar === avatar ? 'border-primary bg-primary/10' : 'border-transparent hover:border-muted'
                        }`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Room Code</label>
                  <Input 
                    value={joinCode} 
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter room code"
                    className="text-center text-lg font-mono tracking-widest uppercase"
                    maxLength={6}
                  />
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  disabled={!joinCode || !displayName || joinRoomMutation.isPending}
                  onClick={() => joinRoomMutation.mutate()}
                >
                  {joinRoomMutation.isPending ? 'Joining...' : (
                    <><UserPlus className="w-4 h-4 mr-2" /> Join Battle</>
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

// ─── Active Rooms List Component ───
const ActiveRoomsList = ({ onJoin }: { onJoin: (room: BattleRoom) => void }) => {
  const { data: rooms, isLoading } = useQuery({
    queryKey: ['active-battle-rooms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('battle_rooms')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data as BattleRoom[];
    },
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="text-center py-12">
        <Radio className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No active rooms. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {rooms.map(room => (
        <Card key={room.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-xl">
              ⚔️
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold">{room.name}</h4>
                <Badge variant="outline" className="text-xs font-mono">{room.code}</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {room.current_players}/{room.max_players}</span>
                <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {room.question_count} Qs</span>
                <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> {room.time_per_question}s</span>
              </div>
            </div>
            <Button onClick={() => onJoin(room)} disabled={room.current_players >= room.max_players}>
              {room.current_players >= room.max_players ? 'Full' : 'Join'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default BattleArena;
