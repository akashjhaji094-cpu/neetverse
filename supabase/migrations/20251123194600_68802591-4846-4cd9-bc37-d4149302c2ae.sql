-- Create premium access keys table
CREATE TABLE public.premium_access_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_key TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(user_id)
);

-- Create premium planners table
CREATE TABLE public.premium_planners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  access_key TEXT REFERENCES public.premium_access_keys(access_key) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.premium_access_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_planners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for premium_access_keys
CREATE POLICY "Admins can manage access keys"
  ON public.premium_access_keys
  FOR ALL
  USING (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'content_admin'::app_role));

CREATE POLICY "Users can view their own access key"
  ON public.premium_access_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for premium_planners
CREATE POLICY "Admins can manage planners"
  ON public.premium_planners
  FOR ALL
  USING (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'content_admin'::app_role));

CREATE POLICY "Users can view planners for their access key"
  ON public.premium_planners
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.premium_access_keys
      WHERE premium_access_keys.access_key = premium_planners.access_key
      AND premium_access_keys.user_id = auth.uid()
      AND premium_access_keys.is_active = true
    )
  );