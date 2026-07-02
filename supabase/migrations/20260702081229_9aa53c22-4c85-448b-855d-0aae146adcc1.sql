ALTER TABLE public.adaptive_question_pools ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.adaptive_question_pools TO authenticated;
GRANT ALL ON public.adaptive_question_pools TO service_role;
DROP POLICY IF EXISTS "Auth users read adaptive pools" ON public.adaptive_question_pools;
CREATE POLICY "Auth users read adaptive pools"
ON public.adaptive_question_pools FOR SELECT
TO authenticated USING (true);