
-- Auto-classify new questions into topics based on keyword overlap
CREATE OR REPLACE FUNCTION public.auto_classify_question_topics()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  qtext text;
  matched_count int := 0;
BEGIN
  qtext := lower(coalesce(NEW.question_text,''));
  -- Insert into every topic in this chapter whose keywords appear in the question text
  INSERT INTO public.question_topics (question_id, topic_id)
  SELECT NEW.id, t.id FROM public.topics t
  WHERE t.chapter_id = NEW.chapter_id
    AND t.slug <> 'general'
    AND EXISTS (
      SELECT 1 FROM unnest(t.keywords) kw
      WHERE length(kw) >= 4 AND position(kw IN qtext) > 0
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS matched_count = ROW_COUNT;

  -- Fallback: assign to the chapter's General topic if no keyword topic matched
  IF matched_count = 0 THEN
    INSERT INTO public.question_topics (question_id, topic_id)
    SELECT NEW.id, t.id FROM public.topics t
    WHERE t.chapter_id = NEW.chapter_id AND t.slug = 'general'
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_classify_question_topics ON public.questions;
CREATE TRIGGER trg_auto_classify_question_topics
AFTER INSERT ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.auto_classify_question_topics();

-- Set stable search_path on the earlier RPC too
ALTER FUNCTION public.get_question_counts_per_topic() SET search_path = public;
