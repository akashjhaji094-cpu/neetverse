CREATE TABLE public.question_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'ai',
  content text NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_question_explanations_qid ON public.question_explanations(question_id);

GRANT SELECT ON public.question_explanations TO authenticated;
GRANT ALL ON public.question_explanations TO service_role;

ALTER TABLE public.question_explanations ENABLE ROW LEVEL SECURITY;

-- Only users with an active access key (trial or paid) can read explanations
CREATE POLICY "Members with active access can read explanations"
ON public.question_explanations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.premium_access_keys k
    WHERE k.user_id = auth.uid()
      AND k.is_active = true
      AND (k.expires_at IS NULL OR k.expires_at > now())
  )
);

CREATE TRIGGER trg_question_explanations_updated_at
BEFORE UPDATE ON public.question_explanations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();