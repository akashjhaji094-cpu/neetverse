CREATE OR REPLACE FUNCTION public.get_question_counts_per_chapter()
RETURNS TABLE(chapter_id uuid, total bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT chapter_id, COUNT(*)::bigint AS total
  FROM public.questions
  GROUP BY chapter_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_question_counts_per_chapter() TO anon, authenticated, service_role;