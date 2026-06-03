-- PYQ papers (one row per uploaded PDF)
CREATE TABLE public.pyq_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL,
  subject_id UUID,
  title TEXT NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pyq_papers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pyq_papers TO authenticated;
GRANT ALL ON public.pyq_papers TO service_role;

ALTER TABLE public.pyq_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pyq papers"
  ON public.pyq_papers FOR SELECT USING (true);

CREATE POLICY "Admins manage pyq papers"
  ON public.pyq_papers FOR ALL
  USING (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'content_admin'::app_role));

-- PYQ questions (one row per page-image)
CREATE TABLE public.pyq_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID NOT NULL REFERENCES public.pyq_papers(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL,
  subject_id UUID,
  page_number INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  correct_option_index INTEGER NOT NULL CHECK (correct_option_index BETWEEN 0 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pyq_questions_chapter ON public.pyq_questions(chapter_id);
CREATE INDEX idx_pyq_questions_paper ON public.pyq_questions(paper_id);

GRANT SELECT ON public.pyq_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pyq_questions TO authenticated;
GRANT ALL ON public.pyq_questions TO service_role;

ALTER TABLE public.pyq_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pyq questions"
  ON public.pyq_questions FOR SELECT USING (true);

CREATE POLICY "Admins manage pyq questions"
  ON public.pyq_questions FOR ALL
  USING (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'content_admin'::app_role));

-- Allow admins to upload PYQ images to existing question-images bucket under pyqs/* prefix
CREATE POLICY "Admins upload pyq images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'question-images'
    AND (storage.foldername(name))[1] = 'pyqs'
    AND (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'content_admin'::app_role))
  );