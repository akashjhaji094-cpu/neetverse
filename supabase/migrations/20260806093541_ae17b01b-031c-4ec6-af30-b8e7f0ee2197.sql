
CREATE TABLE public.explanation_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitter_name text,
  subject_id uuid REFERENCES public.subjects(id),
  chapter_id uuid REFERENCES public.chapters(id),
  topic_id uuid REFERENCES public.topics(id),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.explanation_submissions TO authenticated;
GRANT ALL ON public.explanation_submissions TO service_role;

ALTER TABLE public.explanation_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own explanation submissions"
  ON public.explanation_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users read own explanation submissions"
  ON public.explanation_submissions FOR SELECT TO authenticated
  USING (auth.uid() = submitted_by
    OR public.has_role(auth.uid(), 'superadmin')
    OR public.has_role(auth.uid(), 'content_admin'));

CREATE POLICY "Admins update explanation submissions"
  ON public.explanation_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'content_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'content_admin'));

CREATE POLICY "Admins delete explanation submissions"
  ON public.explanation_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'content_admin'));

CREATE INDEX idx_expl_sub_status ON public.explanation_submissions(status, created_at DESC);
CREATE INDEX idx_expl_sub_question ON public.explanation_submissions(question_id);

CREATE TRIGGER trg_expl_sub_updated_at
  BEFORE UPDATE ON public.explanation_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admins can write cached explanations (approval step)
GRANT INSERT, UPDATE ON public.question_explanations TO authenticated;

CREATE POLICY "Admins insert explanations"
  ON public.question_explanations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'content_admin'));

CREATE POLICY "Admins update explanations"
  ON public.question_explanations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'content_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'content_admin'));

-- SECURITY FIX: lock down telegram operational tables
DROP POLICY IF EXISTS "Public can manage telegram settings" ON public.telegram_bot_settings;
DROP POLICY IF EXISTS "Public can manage telegram posted questions" ON public.telegram_posted_questions;
DROP POLICY IF EXISTS "Public can manage telegram post log" ON public.telegram_post_log;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('telegram_bot_settings','telegram_posted_questions','telegram_post_log')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

REVOKE ALL ON public.telegram_bot_settings FROM anon, authenticated;
REVOKE ALL ON public.telegram_posted_questions FROM anon, authenticated;
REVOKE ALL ON public.telegram_post_log FROM anon, authenticated;

GRANT ALL ON public.telegram_bot_settings TO service_role;
GRANT ALL ON public.telegram_posted_questions TO service_role;
GRANT ALL ON public.telegram_post_log TO service_role;

GRANT SELECT, UPDATE ON public.telegram_bot_settings TO authenticated;
GRANT SELECT ON public.telegram_post_log TO authenticated;

CREATE POLICY "Admins read telegram settings" ON public.telegram_bot_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'content_admin'));

CREATE POLICY "Admins update telegram settings" ON public.telegram_bot_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'content_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'content_admin'));

CREATE POLICY "Admins read telegram post log" ON public.telegram_post_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin') OR public.has_role(auth.uid(), 'content_admin'));
