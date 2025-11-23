-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  has_role(auth.uid(), 'content_admin'::app_role)
);

-- Make access_key nullable for premium tests (to support "all keys" option)
ALTER TABLE public.premium_tests 
ALTER COLUMN access_key DROP NOT NULL;

-- Update RLS policy for premium tests to allow access with any active key when access_key is null
DROP POLICY IF EXISTS "Users can view tests for their access key" ON public.premium_tests;

CREATE POLICY "Users can view premium tests"
ON public.premium_tests
FOR SELECT
TO authenticated
USING (
  -- If access_key is null, any user with an active key can access
  (access_key IS NULL AND EXISTS (
    SELECT 1 FROM premium_access_keys
    WHERE user_id = auth.uid() AND is_active = true
  ))
  OR
  -- If access_key is set, only users with that specific key can access
  (access_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM premium_access_keys
    WHERE access_key = premium_tests.access_key 
    AND user_id = auth.uid() 
    AND is_active = true
  ))
);