-- Create premium_tests table for direct PDF uploads
CREATE TABLE IF NOT EXISTS public.premium_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  access_key TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.premium_tests ENABLE ROW LEVEL SECURITY;

-- Admins can manage premium tests
CREATE POLICY "Admins can manage premium tests"
ON public.premium_tests
FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'content_admin'::app_role));

-- Users can view tests for their access key
CREATE POLICY "Users can view tests for their access key"
ON public.premium_tests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM premium_access_keys
    WHERE premium_access_keys.access_key = premium_tests.access_key
    AND premium_access_keys.user_id = auth.uid()
    AND premium_access_keys.is_active = true
  )
);

-- Update premium_planners to remove access_key requirement (make public)
DROP POLICY IF EXISTS "Users can view planners for their access key" ON public.premium_planners;

-- Anyone can view planners
CREATE POLICY "Anyone can view planners"
ON public.premium_planners
FOR SELECT
USING (true);

-- Remove access_key from premium_planners as it's no longer needed
ALTER TABLE public.premium_planners DROP COLUMN IF EXISTS access_key;