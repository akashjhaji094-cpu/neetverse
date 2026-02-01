-- Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create user_streaks table for tracking daily streaks
CREATE TABLE public.user_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_streaks
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_streaks
CREATE POLICY "Users can view their own streak"
ON public.user_streaks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak"
ON public.user_streaks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak"
ON public.user_streaks
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at on user_streaks
CREATE TRIGGER update_user_streaks_updated_at
BEFORE UPDATE ON public.user_streaks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create in_progress_tests table for resumable tests
CREATE TABLE public.in_progress_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  test_type TEXT NOT NULL DEFAULT 'practice',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_question_index INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  question_ids UUID[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on in_progress_tests
ALTER TABLE public.in_progress_tests ENABLE ROW LEVEL SECURITY;

-- RLS policies for in_progress_tests
CREATE POLICY "Users can view their own in-progress tests"
ON public.in_progress_tests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own in-progress tests"
ON public.in_progress_tests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own in-progress tests"
ON public.in_progress_tests
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own in-progress tests"
ON public.in_progress_tests
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at on in_progress_tests
CREATE TRIGGER update_in_progress_tests_updated_at
BEFORE UPDATE ON public.in_progress_tests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();