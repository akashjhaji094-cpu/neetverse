
ALTER TABLE public.pyq_papers
  ADD COLUMN IF NOT EXISTS paper_pdf_url text,
  ADD COLUMN IF NOT EXISTS solution_pdf_url text;

CREATE TABLE IF NOT EXISTS public.pyq_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  unattempted_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pyq_attempts TO authenticated;
GRANT ALL ON public.pyq_attempts TO service_role;

ALTER TABLE public.pyq_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pyq attempts"
  ON public.pyq_attempts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_pyq_attempts_updated_at
  BEFORE UPDATE ON public.pyq_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
