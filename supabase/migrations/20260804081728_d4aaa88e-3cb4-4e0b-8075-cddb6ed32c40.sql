CREATE POLICY "Users can delete answers of their own attempts"
ON public.attempt_answers FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_answers.attempt_id AND a.user_id = auth.uid()));

CREATE POLICY "Users can update answers of their own attempts"
ON public.attempt_answers FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_answers.attempt_id AND a.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_answers.attempt_id AND a.user_id = auth.uid()));