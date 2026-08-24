
-- Read: authenticated (URLs are surfaced via signed URLs; policy needed for createSignedUrl)
CREATE POLICY "read media" ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id IN ('competition-logos','team-logos','player-photos','news-covers'));

CREATE POLICY "admin write media insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('competition-logos','team-logos','player-photos','news-covers')
    AND public.is_admin(auth.uid())
  );
CREATE POLICY "admin write media update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('competition-logos','team-logos','player-photos','news-covers')
    AND public.is_admin(auth.uid())
  );
CREATE POLICY "admin write media delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('competition-logos','team-logos','player-photos','news-covers')
    AND public.is_admin(auth.uid())
  );
