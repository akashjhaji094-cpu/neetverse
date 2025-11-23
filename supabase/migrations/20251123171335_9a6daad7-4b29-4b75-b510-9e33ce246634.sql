-- Create role enum
CREATE TYPE public.app_role AS ENUM ('superadmin', 'content_admin', 'student');

-- Create difficulty enum
CREATE TYPE public.difficulty_level AS ENUM ('auto_easy', 'auto_medium', 'auto_hard', 'manual');

-- Create attempt type enum
CREATE TYPE public.attempt_type AS ENUM ('practice', 'mock');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create chapters table
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subject_id, slug)
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_option_index INTEGER,
  explanation TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  difficulty difficulty_level DEFAULT 'auto_medium',
  source_file TEXT,
  raw_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create attempts table
CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type attempt_type NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  score INTEGER,
  details JSONB DEFAULT '{}'::jsonb
);

-- Create attempt_answers table
CREATE TABLE public.attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.attempts(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  chosen_option_index INTEGER,
  is_correct BOOLEAN,
  time_taken_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notes table
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  file_url TEXT,
  drive_link TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create admin_uploads table
CREATE TABLE public.admin_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  errors JSONB DEFAULT '[]'::jsonb,
  parsed_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'));

-- RLS Policies for subjects (public read, admin write)
CREATE POLICY "Anyone can view subjects"
ON public.subjects FOR SELECT
USING (true);

CREATE POLICY "Admins can manage subjects"
ON public.subjects FOR ALL
USING (
  public.has_role(auth.uid(), 'superadmin') OR 
  public.has_role(auth.uid(), 'content_admin')
);

-- RLS Policies for chapters (public read, admin write)
CREATE POLICY "Anyone can view chapters"
ON public.chapters FOR SELECT
USING (true);

CREATE POLICY "Admins can manage chapters"
ON public.chapters FOR ALL
USING (
  public.has_role(auth.uid(), 'superadmin') OR 
  public.has_role(auth.uid(), 'content_admin')
);

-- RLS Policies for questions (public read, admin write)
CREATE POLICY "Anyone can view questions"
ON public.questions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage questions"
ON public.questions FOR ALL
USING (
  public.has_role(auth.uid(), 'superadmin') OR 
  public.has_role(auth.uid(), 'content_admin')
);

-- RLS Policies for attempts
CREATE POLICY "Users can view their own attempts"
ON public.attempts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attempts"
ON public.attempts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts"
ON public.attempts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attempts"
ON public.attempts FOR SELECT
USING (
  public.has_role(auth.uid(), 'superadmin') OR 
  public.has_role(auth.uid(), 'content_admin')
);

-- RLS Policies for attempt_answers
CREATE POLICY "Users can view their own answers"
ON public.attempt_answers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.attempts
    WHERE attempts.id = attempt_answers.attempt_id
    AND attempts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own answers"
ON public.attempt_answers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.attempts
    WHERE attempts.id = attempt_answers.attempt_id
    AND attempts.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all answers"
ON public.attempt_answers FOR SELECT
USING (
  public.has_role(auth.uid(), 'superadmin') OR 
  public.has_role(auth.uid(), 'content_admin')
);

-- RLS Policies for notes (public read, admin write)
CREATE POLICY "Anyone can view notes"
ON public.notes FOR SELECT
USING (true);

CREATE POLICY "Admins can manage notes"
ON public.notes FOR ALL
USING (
  public.has_role(auth.uid(), 'superadmin') OR 
  public.has_role(auth.uid(), 'content_admin')
);

-- RLS Policies for admin_uploads
CREATE POLICY "Admins can manage uploads"
ON public.admin_uploads FOR ALL
USING (
  public.has_role(auth.uid(), 'superadmin') OR 
  public.has_role(auth.uid(), 'content_admin')
);

-- Create trigger function for profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', ''),
    new.email
  );
  
  -- Assign default student role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'student');
  
  RETURN new;
END;
$$;

-- Trigger to auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_chapters_subject ON public.chapters(subject_id);
CREATE INDEX idx_questions_chapter ON public.questions(chapter_id);
CREATE INDEX idx_questions_subject ON public.questions(subject_id);
CREATE INDEX idx_attempts_user ON public.attempts(user_id);
CREATE INDEX idx_attempt_answers_attempt ON public.attempt_answers(attempt_id);
CREATE INDEX idx_notes_subject ON public.notes(subject_id);
CREATE INDEX idx_notes_chapter ON public.notes(chapter_id);

-- Insert default subjects
INSERT INTO public.subjects (name, slug) VALUES
  ('Physics', 'physics'),
  ('Chemistry', 'chemistry'),
  ('Zoology', 'zoology'),
  ('Botany', 'botany');