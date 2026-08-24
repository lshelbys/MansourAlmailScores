DROP POLICY IF EXISTS "read news" ON public.news_posts;
CREATE POLICY "read published news" ON public.news_posts FOR SELECT TO anon, authenticated
  USING (published_at IS NOT NULL AND published_at <= now());
CREATE POLICY "admins read all news" ON public.news_posts FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));