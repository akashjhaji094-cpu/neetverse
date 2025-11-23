-- Create storage bucket for question images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for question images storage
CREATE POLICY "Public can view question images"
ON storage.objects FOR SELECT
USING (bucket_id = 'question-images');

CREATE POLICY "Admins can upload question images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'question-images' 
  AND (
    has_role(auth.uid(), 'superadmin'::app_role) 
    OR has_role(auth.uid(), 'content_admin'::app_role)
  )
);

CREATE POLICY "Admins can delete question images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'question-images' 
  AND (
    has_role(auth.uid(), 'superadmin'::app_role) 
    OR has_role(auth.uid(), 'content_admin'::app_role)
  )
);