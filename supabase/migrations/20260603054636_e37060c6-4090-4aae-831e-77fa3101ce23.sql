-- Remove any public/anon SELECT exposure on premium_planners
DROP POLICY IF EXISTS "Anyone can view planners" ON public.premium_planners;
REVOKE SELECT ON public.premium_planners FROM anon;