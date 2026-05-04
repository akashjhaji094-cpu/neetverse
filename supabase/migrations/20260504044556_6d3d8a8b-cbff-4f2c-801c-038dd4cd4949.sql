DROP POLICY IF EXISTS "Anyone can view planners" ON public.premium_planners;

CREATE POLICY "Premium users can view planners"
ON public.premium_planners
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.premium_access_keys
    WHERE premium_access_keys.user_id = auth.uid()
      AND premium_access_keys.is_active = true
  )
);