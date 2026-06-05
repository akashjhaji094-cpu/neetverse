
-- Migrate pyq_attempts to be per-paper (set) instead of per-chapter, and store per-question answers for review
ALTER TABLE public.pyq_attempts ADD COLUMN IF NOT EXISTS paper_id uuid REFERENCES public.pyq_papers(id) ON DELETE CASCADE;
ALTER TABLE public.pyq_attempts ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.pyq_attempts ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.pyq_attempts ADD COLUMN IF NOT EXISTS time_taken_seconds integer;

-- Drop old unique constraint on (user_id, chapter_id) if exists
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.pyq_attempts'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%user_id%chapter_id%'
    AND pg_get_constraintdef(oid) NOT ILIKE '%paper_id%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pyq_attempts DROP CONSTRAINT %I', c);
  END IF;
END $$;

-- New unique constraint on (user_id, paper_id) so each user has one attempt per set (re-attempt updates it)
CREATE UNIQUE INDEX IF NOT EXISTS pyq_attempts_user_paper_unique
  ON public.pyq_attempts(user_id, paper_id)
  WHERE paper_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pyq_attempts_user_chapter_idx ON public.pyq_attempts(user_id, chapter_id);
CREATE INDEX IF NOT EXISTS pyq_attempts_user_subject_idx ON public.pyq_attempts(user_id, subject_id);
