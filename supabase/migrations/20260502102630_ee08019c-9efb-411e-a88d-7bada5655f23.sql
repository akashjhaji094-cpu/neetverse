-- Table for admin broadcast messages
CREATE TABLE public.admin_broadcasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Announcement',
  body TEXT NOT NULL,
  created_by UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view broadcasts"
ON public.admin_broadcasts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage broadcasts"
ON public.admin_broadcasts FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'content_admin'::app_role));

CREATE TRIGGER update_admin_broadcasts_updated_at
BEFORE UPDATE ON public.admin_broadcasts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-deactivate older broadcasts when a new active one comes in
CREATE OR REPLACE FUNCTION public.deactivate_older_broadcasts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.admin_broadcasts
       SET is_active = false
     WHERE id <> NEW.id
       AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deactivate_older_broadcasts
AFTER INSERT ON public.admin_broadcasts
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_older_broadcasts();

-- Read tracking per user
CREATE TABLE public.user_broadcast_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  broadcast_id UUID NOT NULL REFERENCES public.admin_broadcasts(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, broadcast_id)
);

ALTER TABLE public.user_broadcast_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reads"
ON public.user_broadcast_reads FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reads"
ON public.user_broadcast_reads FOR SELECT
USING (has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'content_admin'::app_role));

CREATE POLICY "Users can create their own reads"
ON public.user_broadcast_reads FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reads"
ON public.user_broadcast_reads FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX idx_admin_broadcasts_active ON public.admin_broadcasts(is_active, created_at DESC);
CREATE INDEX idx_user_broadcast_reads_user ON public.user_broadcast_reads(user_id);