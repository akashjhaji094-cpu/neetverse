// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { SafeImage, ImageGrid } from '@/components/SafeImage';
import { useMathJax } from '@/hooks/useMathJax';
import {
  Swords, Users, Trophy, Crown, Zap, Timer, ArrowRight, Copy,
  CheckCircle2, XCircle, Star, Flame, Shield, Sword, Gem, Medal,
  Radio, UserPlus, LogOut, Play, RotateCcw, Volume2, VolumeX,
  Sparkles, Target, TrendingUp, Clock, ChevronRight, AlertCircle,
  Wifi, WifiOff, BookOpen, Loader2, CircleDot
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───
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
  created_at: string;
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
  last_seen_at: string;
}

interface BattleQuestionState {
  room_id: string;
  question_index: number;
  question_id: string;
  status: 'active' | 'revealed' | 'finished';
  ends_at: string;
  player_answers: Record<string, { option_index: number; time_taken_ms: number; is_correct: boolean | null }>;
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

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  rating: number;
  rank_tier: string;
  total_battles: number;
  total_wins: number;
  best_streak: number;
}

interface BattleHistoryEntry {
  id: string;
  user_id: string;
  room_id: string;
  subject_name: string | null;
  final_rank: number;
  score: number;
  correct_count: number;
  wrong_count: number;
  max_streak: number;
  rating_change: number;
  played_at: string;
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

// ─── Safe JSON Parser ───
function safeParseJSON<T>(input: any, fallback: T): T {
  if (input === null || input === undefined) return fallback;
  if (Array.isArray(input)) return input as unknown as T;
  if (typeof input === 'object') return input as T;
  if (typeof input === 'string') {
    try { return JSON.parse(input); } catch { return fallback; }
  }
  return fallback;
}

function safeParseOptions(input: any): string[] {
  const parsed = safeParseJSON<string[]>(input, []);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  return ['Option A', 'Option B', 'Option C', 'Option D'];
}

// ─── Connection Status Hook ───
function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return isOnline;
}

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
  const [questionState, setQuestionState] = useState<BattleQuestionState | null>(null);
  const [finalResults, setFinalResults] = useState<BattlePlayer[] | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnline = useConnectionStatus();
  const { ref: mathRef } = useMathJax([currentQuestion, showResults]);

  const currentPlayer = players.find(p => p.user_id === currentUserId);
  const isHost = currentPlayer?.is_host || false;

  // Setup realtime subscriptions with auto-reconnect
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    const setupChannel = () => {
      if (!mounted) return;

      const channel = supabase.channel(`battle:${room.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: currentUserId },
        }
      });

      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battle_question_states',
        filter: `room_id=eq.${room.id}`
      }, (payload: any) => {
        if (!mounted) return;
        const newState = payload.new as BattleQuestionState;
        setQuestionState(newState);
        
        if (newState.status === 'active') {
          setCurrentQuestion(newState.question_index);
          setSelectedOption(null);
          setHasAnswered(false);
          setShowResults(false);
        } else if (newState.status === 'revealed') {
          setShowResults(true);
        }
      });

      channel.on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battle_rooms',
        filter: `id=eq.${room.id}`
      }, (payload: any) => {
        if (!mounted) return;
        const updated = payload.new as BattleRoom;
        
        if (updated.status === 'countdown') {
          setCountdown(3);
        } else if (updated.status === 'finished') {
          const ranked = [...players].sort((a, b) => b.score - a.score);
          setFinalResults(ranked);
        }
      });

      channel.subscribe((status: string) => {
        if (!mounted) return;
        if (status === 'SUBSCRIBED') {
          setIsReconnecting(false);
          retryCount = 0;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            setIsReconnecting(true);
            reconnectTimeoutRef.current = setTimeout(() => {
              if (mounted) setupChannel();
            }, Math.min(1000 * Math.pow(2, retryCount), 10000));
          }
        }
      });

      channelRef.current = channel;
    };

    setupChannel();

    return () => {
      mounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [room.id, currentUserId]);

  // Countdown timer
  useEffect(() => {
    if (room.status === 'countdown' && countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [countdown, room.status]);

  const handleAnswer = async (optionIndex: number) => {
    if (hasAnswered || showResults || !questionState) return;
    setSelectedOption(optionIndex);
    setHasAnswered(true);

    const timeTaken = questionState.ends_at 
      ? Math.max(0, new Date(questionState.ends_at).getTime() - Date.now())
      : room.time_per_question * 1000;
    const timeTakenMs = room.time_per_question * 1000 - timeTaken;

    try {
      await supabase.from('battle_question_states').update({
        player_answers: {
          ...(questionState.player_answers || {}),
          [currentUserId]: {
            option_index: optionIndex,
            time_taken_ms: Math.max(0, timeTakenMs),
            is_correct: null
          }
        }
      }).eq('room_id', room.id).eq('question_index', currentQuestion);
    } catch (err) {
      console.error('Failed to submit answer:', err);
      toast.error('Failed to submit answer. Please try again.');
    }
  };

  const handleStartGame = async () => {
    if (!isHost) return;

    const allReady = players.every(p => p.is_ready || p.is_host);
    if (!allReady) {
      toast.error('Not all players are ready!');
      return;
    }

    if (players.length < 2) {
      toast.error('Need at least 2 players to start');
      return;
    }

    try {
      let query = supabase
        .from('questions')
        .select('id, question_text, options, correct_option_index, explanation, images, difficulty, chapter_id, subject_id')
        .limit(500);

      if (room.subject_id) {
        query = query.eq('subject_id', room.subject_id);
      }
      if (room.chapter_id) {
        query = query.eq('chapter_id', room.chapter_id);
      }

      const { data: questions, error } = await query;

if (error) throw error;

let finalQuestions = questions || [];

if (finalQuestions.length < room.question_count) {
  // Fallback: fetch from subject if chapter doesn't have enough
  const { data: fallback } = await supabase
    .from('questions')
    .select('id, question_text, options, correct_option_index, explanation, images, difficulty, chapter_id, subject_id')
    .eq('subject_id', room.subject_id)
    .limit(room.question_count);
  
  if (fallback && fallback.length >= room.question_count) {
    finalQuestions = fallback;
  } else if (finalQuestions.length === 0) {
    toast.error("No questions found in database for this subject.");
    return;
  } else {
    toast.warning(`Only ${finalQuestions.length} questions available. Starting with what we have.`);
  }
}

const shuffled = [...finalQuestions].sort(() => Math.random() - 0.5).slice(0, Math.min(finalQuestions.length, room.question_count));
      
      await supabase.from('battle_rooms').update({
        status: 'countdown',
        questions: shuffled,
      }).eq('id', room.id);

      setTimeout(async () => {
        try {
          await supabase.from('battle_rooms').update({
            status: 'active',
            started_at: new Date().toISOString(),
            current_question_index: 0,
          }).eq('id', room.id);

          await supabase.from('battle_question_states').insert({
            room_id: room.id,
            question_index: 0,
            question_id: shuffled[0].id,
            status: 'active',
            ends_at: new Date(Date.now() + room.time_per_question * 1000).toISOString(),
            player_answers: {},
          });
        } catch (err) {
          console.error('Failed to start game:', err);
        }
      }, 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start game');
    }
  };

  const handleToggleReady = async () => {
    if (!currentPlayer) return;
    try {
      await supabase.from('battle_players').update({
        is_ready: !currentPlayer.is_ready,
        last_seen_at: new Date().toISOString(),
      }).eq('room_id', room.id).eq('user_id', currentUserId);
    } catch (err) {
      toast.error('Failed to update ready status');
    }
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
          <AnimatePresence mode="wait">
            <motion.div
              key={countdown}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="text-8xl font-black text-primary"
            >
              {countdown > 0 ? countdown : 'GO!'}
            </motion.div>
          </AnimatePresence>
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
  if (finalResults || room.status === 'finished') {
    const results = finalResults || [...players].sort((a, b) => b.score - a.score);
    const myRank = results.findIndex(p => p.user_id === currentUserId) + 1;

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
            You ranked <span className="font-bold text-primary">#{myRank}</span> out of {results.length}
          </p>
        </motion.div>

        <div className="space-y-3">
          {results.map((player, idx) => (
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
              {Array.from({ length: Math.max(0, room.max_players - players.length) }).map((_, i) => (
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
  const question = room.questions?.[currentQuestion];
  if (!question) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading question...</p>
        </div>
      </div>
    );
  }

  const progress = ((currentQuestion) / room.question_count) * 100;
  const options = safeParseOptions(question.options);
  const images = safeParseJSON<string[]>(question.images, []);

  return (
    <div className="max-w-4xl mx-auto space-y-4" ref={mathRef}>
      {!isOnline && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <WifiOff className="w-4 h-4" />
          You are offline. Answers may not sync until you reconnect.
        </div>
      )}
      {isReconnecting && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Reconnecting to server...
        </div>
      )}

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

      {questionState?.status === 'active' && (
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-green-500"
            style={{ width: `${questionState?.ends_at ? 
              Math.max(0, (new Date(questionState.ends_at).getTime() - Date.now()) / (room.time_per_question * 1000) * 100) 
              : 0}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      )}

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

              {images.length > 0 && (
                <ImageGrid images={images} alt={`Question ${currentQuestion + 1}`} />
              )}

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
                        {showResults && idx === question.correct_option_index && (
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                        {showResults && idx === selectedOption && idx !== question.correct_option_index && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
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
                    {players.sort((a, b) => b.score - a.score).map((player) => {
                      const answer = questionState?.player_answers?.[player.user_id];
                      const isCorrect = answer?.is_correct;
                      const points = isCorrect ? Math.round(100 + (answer?.time_taken_ms < 15000 ? 50 : 0)) : 0;

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
                          <span className="font-medium">+{points}</span>
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
  const queryClient = useQueryClient();
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
  const roomChannelRef = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      return (data || []) as LeaderboardEntry[];
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
      return (data || []) as BattleHistoryEntry[];
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
      return data as LeaderboardEntry | null;
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
        is_connected: true,
        last_seen_at: new Date().toISOString(),
      });

      return room as BattleRoom;
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
        .maybeSingle();

      if (!existing) {
        await supabase.from('battle_players').insert({
          room_id: room.id,
          user_id: user.id,
          display_name: displayName || user.user_metadata?.name || 'Player',
          avatar_emoji: selectedAvatar,
          is_connected: true,
          last_seen_at: new Date().toISOString(),
        });
      } else {
        await supabase.from('battle_players').update({
          is_connected: true,
          last_seen_at: new Date().toISOString(),
        }).eq('id', existing.id);
      }

      return room as BattleRoom;
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

  // Subscribe to room updates with heartbeat
  useEffect(() => {
    if (!currentRoom || !user) return;
    let mounted = true;

    const setupRoomChannel = () => {
      const channel = supabase.channel(`room:${currentRoom.id}`, {
        config: {
          broadcast: { self: true },
        }
      });

      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battle_players',
        filter: `room_id=eq.${currentRoom.id}`
      }, () => {
        if (!mounted) return;
        supabase.from('battle_players')
          .select('*')
          .eq('room_id', currentRoom.id)
          .then(({ data }) => {
            if (data && mounted) setRoomPlayers(data);
          });
      });

      // Replace lines 1017-1027 with this:
channel.on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'battle_rooms',
  filter: `id=eq.${currentRoom.id}`
}, (payload) => {
  if (!mounted) return;
  const updatedRoom = payload.new as BattleRoom;
  setCurrentRoom(updatedRoom);
  
  // Force refresh questions if game started
  if (updatedRoom.status === 'active' && updatedRoom.questions) {
    setQuestions(updatedRoom.questions);
    setCurrentQuestion(updatedRoom.current_question_index || 0);
  }
});
      

      channel.subscribe();
      roomChannelRef.current = channel;
    };

    setupRoomChannel();

    // Heartbeat to keep player connected
    heartbeatRef.current = setInterval(async () => {
      if (!mounted || !user) return;
      await supabase.from('battle_players').update({
        last_seen_at: new Date().toISOString(),
        is_connected: true,
      }).eq('room_id', currentRoom.id).eq('user_id', user.id);
    }, 10000);

    // Initial fetch
    supabase.from('battle_players')
      .select('*')
      .eq('room_id', currentRoom.id)
      .then(({ data }) => {
        if (data && mounted) setRoomPlayers(data);
      });

    return () => {
      mounted = false;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (roomChannelRef.current) {
        roomChannelRef.current.unsubscribe();
      }
    };
  }, [currentRoom?.id, user?.id]);

  const handleLeaveRoom = async () => {
    if (!currentRoom || !user) return;

    try {
      await supabase.from('battle_players')
        .delete()
        .eq('room_id', currentRoom.id)
        .eq('user_id', user.id);

      // If host leaves and room is waiting, delete the room
      if (currentRoom.host_id === user.id && currentRoom.status === 'waiting') {
        await supabase.from('battle_rooms').delete().eq('id', currentRoom.id);
      }
    } catch (err) {
      console.error('Error leaving room:', err);
    }

    setCurrentRoom(null);
    setRoomPlayers([]);
  };

  if (currentRoom) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6">
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
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <Swords className="w-7 h-7 md:w-8 md:h-8 text-primary" />
              Battle Arena
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
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
        <div className="grid md:grid-cols-2 gap-3 md:gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-all group" onClick={() => setShowCreateDialog(true)}>
            <CardContent className="p-4 md:p-6 flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-xl md:text-2xl flex-shrink-0">
                <Swords className="w-6 h-6 md:w-7 md:h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base md:text-lg font-bold group-hover:text-primary transition-colors">Create Battle</h3>
                <p className="text-xs md:text-sm text-muted-foreground">Host a room and invite friends</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-all group" onClick={() => setShowJoinDialog(true)}>
            <CardContent className="p-4 md:p-6 flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xl md:text-2xl flex-shrink-0">
                <UserPlus className="w-6 h-6 md:w-7 md:h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base md:text-lg font-bold group-hover:text-green-500 transition-colors">Join Battle</h3>
                <p className="text-xs md:text-sm text-muted-foreground">Enter a room code to compete</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
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
                leaderboard.map((entry, idx: number) => {
                  const tier = RANK_TIERS[entry.rank_tier] || RANK_TIERS['Bronze'];
                  return (
                    <motion.div
                      key={entry.user_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className={`${entry.user_id === user?.id ? 'border-primary bg-primary/5' : ''}`}>
                        <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
                          <div className="text-lg md:text-xl font-black w-8 md:w-10 text-center flex-shrink-0">
                            {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}
                          </div>
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center text-base md:text-lg flex-shrink-0`}>
                            {tier.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm md:text-base truncate">{entry.display_name}</p>
                            <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-muted-foreground">
                              <span>{entry.total_battles} battles</span>
                              <span>{entry.total_wins} wins</span>
                              <span className="flex items-center gap-1"><Flame className="w-2.5 h-2.5 md:w-3 md:h-3" /> {entry.best_streak}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-base md:text-lg font-black">{entry.rating}</p>
                            <Badge variant="outline" className="text-[10px] md:text-xs">{entry.rank_tier}</Badge>
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
                {battleHistory.map((battle) => (
                  <Card key={battle.id}>
                    <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
                      <div className="text-xl md:text-2xl font-black w-10 md:w-12 text-center flex-shrink-0">
                        {battle.final_rank === 1 ? '👑' : `#${battle.final_rank}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm md:text-base">{battle.subject_name || 'Mixed Subject'}</p>
                          <Badge variant={battle.rating_change >= 0 ? "default" : "destructive"} className="text-[10px] md:text-xs">
                            {battle.rating_change >= 0 ? '+' : ''}{battle.rating_change}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-green-500" /> {battle.correct_count}</span>
                          <span className="flex items-center gap-1"><XCircle className="w-2.5 h-2.5 md:w-3 md:h-3 text-red-500" /> {battle.wrong_count}</span>
                          <span className="flex items-center gap-1"><Flame className="w-2.5 h-2.5 md:w-3 md:h-3 text-orange-500" /> {battle.max_streak}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base md:text-lg font-bold">{battle.score}</p>
                        <p className="text-[10px] md:text-xs text-muted-foreground">{new Date(battle.played_at).toLocaleDateString()}</p>
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
      return (data || []) as BattleRoom[];
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
          <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-lg md:text-xl flex-shrink-0">
              ⚔️
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-sm md:text-base truncate">{room.name}</h4>
                <Badge variant="outline" className="text-[10px] md:text-xs font-mono flex-shrink-0">{room.code}</Badge>
              </div>
              <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5 md:w-3 md:h-3" /> {room.current_players}/{room.max_players}</span>
                <span className="flex items-center gap-1"><Target className="w-2.5 h-2.5 md:w-3 md:h-3" /> {room.question_count} Qs</span>
                <span className="flex items-center gap-1"><Timer className="w-2.5 h-2.5 md:w-3 md:h-3" /> {room.time_per_question}s</span>
              </div>
            </div>
            <Button onClick={() => onJoin(room)} disabled={room.current_players >= room.max_players} size="sm" className="flex-shrink-0">
              {room.current_players >= room.max_players ? 'Full' : 'Join'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default BattleArena;
