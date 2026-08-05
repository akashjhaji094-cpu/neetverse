-- ============ TEST SERIES ============
CREATE TABLE public.test_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  banner_url text,
  access_type text NOT NULL DEFAULT 'free' CHECK (access_type IN ('free','paid')),
  is_published boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.test_series TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_series TO authenticated;
GRANT ALL ON public.test_series TO service_role;
ALTER TABLE public.test_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published series are viewable" ON public.test_series FOR SELECT
  USING (is_published = true OR has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'));
CREATE POLICY "Admins manage series" ON public.test_series FOR ALL TO authenticated
  USING (has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'))
  WITH CHECK (has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'));

-- ============ TESTS INSIDE A SERIES ============
CREATE TABLE public.series_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.test_series(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  position integer NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 180,
  question_count integer NOT NULL DEFAULT 0,
  marks_correct integer NOT NULL DEFAULT 4,
  marks_wrong integer NOT NULL DEFAULT 1,
  scheduled_at timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.series_tests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series_tests TO authenticated;
GRANT ALL ON public.series_tests TO service_role;
ALTER TABLE public.series_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published tests are viewable" ON public.series_tests FOR SELECT
  USING (is_published = true OR has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'));
CREATE POLICY "Admins manage series tests" ON public.series_tests FOR ALL TO authenticated
  USING (has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'))
  WITH CHECK (has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'));

-- ============ QUESTION LIST PER TEST ============
CREATE TABLE public.series_test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.series_tests(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, question_id)
);
GRANT SELECT ON public.series_test_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series_test_questions TO authenticated;
GRANT ALL ON public.series_test_questions TO service_role;
ALTER TABLE public.series_test_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Test questions viewable for published tests" ON public.series_test_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.series_tests t WHERE t.id = test_id
    AND (t.is_published = true OR has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'))));
CREATE POLICY "Admins manage test questions" ON public.series_test_questions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'))
  WITH CHECK (has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'));

-- ============ STUDENT ATTEMPTS ON SERIES TESTS ============
CREATE TABLE public.series_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.series_tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_spent jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  unattempted_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  time_taken_seconds integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.series_attempts TO authenticated;
GRANT ALL ON public.series_attempts TO service_role;
ALTER TABLE public.series_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own series attempts" ON public.series_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'));
CREATE POLICY "Users create own series attempts" ON public.series_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own series attempts" ON public.series_attempts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ COMMUNITY QUESTION SUBMISSIONS ============
CREATE TABLE public.question_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL,
  submitter_name text,
  subject_id uuid REFERENCES public.subjects(id),
  chapter_id uuid REFERENCES public.chapters(id),
  question_type text NOT NULL DEFAULT 'mcq',
  difficulty text,
  question_text text NOT NULL,
  question_image text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  option_images jsonb,
  correct_option_index integer,
  explanation text,
  explanation_image_url text,
  structured_data jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_submissions TO authenticated;
GRANT ALL ON public.question_submissions TO service_role;
ALTER TABLE public.question_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own submissions" ON public.question_submissions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'));
CREATE POLICY "Users create submissions" ON public.question_submissions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "Admins review submissions" ON public.question_submissions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'))
  WITH CHECK (has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'));
CREATE POLICY "Admins delete submissions" ON public.question_submissions FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'));

-- ============ PUSH SUBSCRIPTIONS ============
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subs" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- updated_at triggers
CREATE TRIGGER trg_test_series_updated BEFORE UPDATE ON public.test_series FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_series_tests_updated BEFORE UPDATE ON public.series_tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_series_attempts_updated BEFORE UPDATE ON public.series_attempts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_question_submissions_updated BEFORE UPDATE ON public.question_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leaderboard for a single series test (secure: only published tests)
CREATE OR REPLACE FUNCTION public.get_series_test_leaderboard(p_test_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM series_tests t WHERE t.id = p_test_id
      AND (t.is_published = true OR has_role(auth.uid(),'superadmin') OR has_role(auth.uid(),'content_admin'))) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(row ORDER BY (row->>'score')::int DESC, (row->>'timeTakenSeconds')::int ASC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'userId', sa.user_id,
      'name', COALESCE(p.name, split_part(p.email,'@',1), 'Aspirant'),
      'score', COALESCE(sa.score,0),
      'correct', sa.correct_count,
      'wrong', sa.wrong_count,
      'timeTakenSeconds', COALESCE(sa.time_taken_seconds, 0)
    ) AS row
    FROM series_attempts sa
    JOIN profiles p ON p.id = sa.user_id
    WHERE sa.test_id = p_test_id AND sa.finished_at IS NOT NULL
  ) x;

  RETURN COALESCE(v_result, '[]'::jsonb);
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_series_test_leaderboard(uuid) FROM anon;