DROP POLICY IF EXISTS "Users read avatars" ON storage.objects;
CREATE POLICY "Users read own avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);