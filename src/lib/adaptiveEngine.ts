import { supabase } from '@/integrations/supabase/client';

export interface QuestionData {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string | null;
  images: string[] | null;
  difficulty: 'auto_easy' | 'auto_medium' | 'auto_hard' | 'manual';
  chapter_id: string;
  subject_id: string;
  bloom_level?: number;
  concept_tags?: string[];
}

export interface UserSkillData {
  chapter_id: string;
  skill_level: number;
  questions_attempted: number;
  questions_correct: number;
  consecutive_correct: number;
  consecutive_wrong: number;
  avg_response_time: number;
  last_attempted_at: string | null;
  weak_concepts: string[];
  strong_concepts: string[];
}

export interface AdaptiveConfig {
  userId: string;
  subjectId: string;
  chapterId?: string;
  mode: 'chapter' | 'subject' | 'mixed';
  targetQuestionCount?: number;
  sessionHistory?: SessionAnswer[];
}

export interface SessionAnswer {
  questionId: string;
  isCorrect: boolean;
  timeTaken: number;
  difficulty: string;
  bloomLevel: number;
}

export interface SelectedQuestion {
  question: QuestionData;
  selectionReason: string;
  predictedDifficulty: number;
}

export function calculateDynamicDifficulty(
  skillData: UserSkillData,
  sessionAnswers: SessionAnswer[]
): number {
  let baseLevel = skillData.skill_level;
  
  if (sessionAnswers.length >= 3) {
    const recent = sessionAnswers.slice(-3);
    const recentAccuracy = recent.filter(a => a.isCorrect).length / recent.length;
    const avgTime = recent.reduce((a, b) => a + b.timeTaken, 0) / recent.length;
    
    const speedFactor = avgTime < 30 ? 5 : avgTime > 90 ? -5 : 0;
    const streakBonus = skillData.consecutive_correct >= 3 ? 8 : 
                       skillData.consecutive_wrong >= 2 ? -8 : 0;
    const accuracyAdjust = recentAccuracy > 0.8 ? 10 :
                          recentAccuracy < 0.4 ? -10 : 0;
    
    baseLevel = Math.min(100, Math.max(0, baseLevel + speedFactor + streakBonus + accuracyAdjust));
  }
  
  return baseLevel;
}

export function difficultyToLevel(diff: string): number {
  switch (diff) {
    case 'auto_easy': return 25;
    case 'auto_medium': return 55;
    case 'auto_hard': return 85;
    default: return 50;
  }
}

export async function selectAdaptiveQuestions(
  config: AdaptiveConfig
): Promise<SelectedQuestion[]> {
  const { userId, subjectId, chapterId, mode, targetQuestionCount = 15 } = config;
  
  const { data: skillData } = await supabase
    .from('user_skill_levels')
    .select('*')
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .maybeSingle();
  
  const userSkill: UserSkillData = skillData || {
    chapter_id: chapterId || '',
    skill_level: 50,
    questions_attempted: 0,
    questions_correct: 0,
    consecutive_correct: 0,
    consecutive_wrong: 0,
    avg_response_time: 60,
    last_attempted_at: null,
    weak_concepts: [],
    strong_concepts: [],
  };

  let query = supabase
    .from('questions')
    .select('id, question_text, options, correct_option_index, explanation, images, difficulty, chapter_id, subject_id, bloom_level, concept_tags')
    .eq('subject_id', subjectId)
    .limit(500);

  if (chapterId && mode === 'chapter') {
    query = query.eq('chapter_id', chapterId);
  }

  const { data: allQuestions, error } = await query;
  if (error || !allQuestions?.length) {
    throw new Error(`No questions found: ${error?.message || 'Empty result'}`);
  }

  const questions = allQuestions as QuestionData[];
  const dynamicLevel = calculateDynamicDifficulty(userSkill, config.sessionHistory || []);
  
  const unseen: QuestionData[] = [];
  const incorrect: QuestionData[] = [];
  const revision: QuestionData[] = [];
  
  const questionIds = questions.map(q => q.id);
  const { data: prevAnswers } = await supabase
    .from('attempt_answers')
    .select('question_id, is_correct')
    .in('question_id', questionIds)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const answeredMap = new Map<string, boolean>();
  prevAnswers?.forEach(a => {
    if (!answeredMap.has(a.question_id)) {
      answeredMap.set(a.question_id, a.is_correct || false);
    }
  });

  questions.forEach(q => {
    const wasCorrect = answeredMap.get(q.id);
    if (wasCorrect === undefined) unseen.push(q);
    else if (!wasCorrect) incorrect.push(q);
    else revision.push(q);
  });

  const targetUnseen = Math.floor(targetQuestionCount * 0.7);
  const targetIncorrect = Math.floor(targetQuestionCount * 0.2);
  const targetRevision = targetQuestionCount - targetUnseen - targetIncorrect;

  const selected: SelectedQuestion[] = [];
  const usedConcepts = new Set<string>();

  const pickBest = (pool: QuestionData[], count: number, reason: string): QuestionData[] => {
    const scored = pool.map(q => {
      const diffScore = -Math.abs(difficultyToLevel(q.difficulty) - dynamicLevel);
      const conceptPenalty = q.concept_tags?.some(c => usedConcepts.has(c)) ? -20 : 0;
      return { q, score: diffScore + conceptPenalty };
    });
    
    scored.sort((a, b) => b.score - a.score);
    const picked = scored.slice(0, count).map(s => s.q);
    
    picked.forEach(q => {
      q.concept_tags?.forEach(c => usedConcepts.add(c));
    });
    
    return picked;
  };

  pickBest(unseen, targetUnseen, 'unseen').forEach(q => {
    selected.push({ question: q, selectionReason: 'New concept - unseen question', predictedDifficulty: dynamicLevel });
  });

  pickBest(incorrect, targetIncorrect, 'incorrect').forEach(q => {
    selected.push({ question: q, selectionReason: 'Previously incorrect - retry', predictedDifficulty: dynamicLevel });
  });

  pickBest(revision.filter(q => difficultyToLevel(q.difficulty) >= dynamicLevel - 10), targetRevision, 'revision').forEach(q => {
    selected.push({ question: q, selectionReason: 'Revision - mastered concept', predictedDifficulty: dynamicLevel });
  });

  while (selected.length < targetQuestionCount) {
    const remaining = [...unseen, ...incorrect, ...revision].filter(
      q => !selected.some(s => s.question.id === q.id)
    );
    if (!remaining.length) break;
    const q = remaining[Math.floor(Math.random() * remaining.length)];
    selected.push({ question: q, selectionReason: 'Fallback selection', predictedDifficulty: dynamicLevel });
  }

  return selected.sort(() => Math.random() - 0.5);
}

export async function updateSkillLevel(
  userId: string,
  chapterId: string,
  isCorrect: boolean,
  timeTaken: number,
  questionDifficulty: string,
  conceptTags?: string[]
): Promise<void> {
  const { data: existing } = await supabase
    .from('user_skill_levels')
    .select('*')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .maybeSingle();

  const current = existing || {
    user_id: userId,
    chapter_id: chapterId,
    skill_level: 50,
    questions_attempted: 0,
    questions_correct: 0,
    consecutive_correct: 0,
    consecutive_wrong: 0,
    avg_response_time: 60,
    weak_concepts: [],
    strong_concepts: [],
  };

  const expectedScore = current.skill_level / 100;
  const actualScore = isCorrect ? 1 : 0;
  const kFactor = Math.max(10, 40 - current.questions_attempted * 0.5);
  
  let newSkill = current.skill_level + kFactor * (actualScore - expectedScore);
  const timeBonus = isCorrect && timeTaken < 30 ? 2 : 
                   !isCorrect && timeTaken > 120 ? -2 : 0;
  newSkill += timeBonus;
  newSkill = Math.max(0, Math.min(100, newSkill));

  const updates = {
    skill_level: Math.round(newSkill),
    questions_attempted: current.questions_attempted + 1,
    questions_correct: current.questions_correct + (isCorrect ? 1 : 0),
    consecutive_correct: isCorrect ? current.consecutive_correct + 1 : 0,
    consecutive_wrong: isCorrect ? 0 : current.consecutive_wrong + 1,
    avg_response_time: Math.round(
      (current.avg_response_time * current.questions_attempted + timeTaken) / (current.questions_attempted + 1)
    ),
    last_attempted_at: new Date().toISOString(),
    weak_concepts: isCorrect ? current.weak_concepts : 
      [...new Set([...current.weak_concepts, ...(conceptTags || [])])].slice(0, 10),
    strong_concepts: isCorrect && current.consecutive_correct >= 2 ?
      [...new Set([...current.strong_concepts, ...(conceptTags || [])])].slice(0, 10) :
      current.strong_concepts,
  };

  if (existing) {
    await supabase.from('user_skill_levels').update(updates).eq('id', existing.id);
  } else {
    await supabase.from('user_skill_levels').insert({ ...updates, user_id: userId, chapter_id: chapterId });
  }
}

