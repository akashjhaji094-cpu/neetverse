
-- Topics table: sub-division inside each chapter
CREATE TABLE public.topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, slug)
);
GRANT SELECT ON public.topics TO anon, authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Topics are viewable by everyone" ON public.topics FOR SELECT USING (true);
CREATE POLICY "Admins manage topics" ON public.topics FOR ALL USING (
  public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'content_admin')
) WITH CHECK (
  public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'content_admin')
);
CREATE INDEX topics_chapter_id_idx ON public.topics(chapter_id);

-- Junction table (one question can belong to multiple topics)
CREATE TABLE public.question_topics (
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, topic_id)
);
GRANT SELECT ON public.question_topics TO anon, authenticated;
GRANT ALL ON public.question_topics TO service_role;
ALTER TABLE public.question_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Question topics viewable by everyone" ON public.question_topics FOR SELECT USING (true);
CREATE POLICY "Admins manage question topics" ON public.question_topics FOR ALL USING (
  public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'content_admin')
) WITH CHECK (
  public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'content_admin')
);
CREATE INDEX question_topics_topic_id_idx ON public.question_topics(topic_id);

-- RPC: question counts per topic (with duplicates counted, matches user's spec)
CREATE OR REPLACE FUNCTION public.get_question_counts_per_topic()
RETURNS TABLE(topic_id UUID, total BIGINT)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT topic_id, COUNT(*)::BIGINT FROM public.question_topics GROUP BY topic_id;
$$;
