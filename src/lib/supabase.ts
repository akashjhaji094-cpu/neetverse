import { supabase } from "@/integrations/supabase/client";

export { supabase };

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRole = {
  id: string;
  user_id: string;
  role: 'superadmin' | 'content_admin' | 'student';
  created_at: string;
};

export type Subject = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type Chapter = {
  id: string;
  subject_id: string;
  name: string;
  slug: string;
  meta: Record<string, any>;
  created_at: string;
};

export type Question = {
  id: string;
  chapter_id: string;
  subject_id: string;
  question_text: string;
  options: string[];
  correct_option_index: number | null;
  explanation: string | null;
  images: string[];
  difficulty: 'auto_easy' | 'auto_medium' | 'auto_hard' | 'manual';
  source_file: string | null;
  raw_html: string | null;
  created_at: string;
  updated_at: string;
};

export type Attempt = {
  id: string;
  user_id: string;
  type: 'practice' | 'mock';
  config: Record<string, any>;
  started_at: string;
  finished_at: string | null;
  score: number | null;
  details: Record<string, any>;
};

export type AttemptAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  chosen_option_index: number | null;
  is_correct: boolean | null;
  time_taken_seconds: number | null;
  created_at: string;
};

export type Note = {
  id: string;
  title: string;
  subject_id: string | null;
  chapter_id: string | null;
  file_url: string | null;
  drive_link: string | null;
  uploaded_by: string | null;
  created_at: string;
};