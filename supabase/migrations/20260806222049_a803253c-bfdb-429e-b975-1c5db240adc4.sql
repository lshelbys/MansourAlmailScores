DROP POLICY IF EXISTS "Active reporters submit" ON public.news_submissions;
CREATE POLICY "Active reporters submit" ON public.news_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND EXISTS (
    SELECT 1 FROM public.news_reporters r WHERE r.user_id = auth.uid() AND r.status IN ('active','approved')
  ));