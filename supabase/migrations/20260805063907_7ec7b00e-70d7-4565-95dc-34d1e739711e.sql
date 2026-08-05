CREATE POLICY "Users upload own manual question images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'question-images'
  AND (storage.foldername(name))[1] = 'manual'
  AND (storage.foldername(name))[2] = auth.uid()::text
);