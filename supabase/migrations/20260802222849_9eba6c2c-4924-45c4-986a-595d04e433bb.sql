-- 1. Seasons within a tournament
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE public.standings_rows ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE public.standings_position_labels ADD COLUMN IF NOT EXISTS season text;

-- 2. Trophies / titles
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS trophies integer NOT NULL DEFAULT 0;
ALTER TABLE public.competition_teams ADD COLUMN IF NOT EXISTS titles integer NOT NULL DEFAULT 0;

-- 3. News linking
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;

-- 4. Currency preference
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';

-- 5. Translation cache writable by server role
GRANT ALL ON public.translations TO service_role;
GRANT SELECT ON public.translations TO anon, authenticated;

-- 6. News reporter programme
CREATE TABLE IF NOT EXISTS public.news_reporters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL,
  platform text NOT NULL DEFAULT 'tiktok',
  access_code text,
  status text NOT NULL DEFAULT 'pending',
  subscription_status text NOT NULL DEFAULT 'inactive',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.news_reporters TO authenticated;
GRANT ALL ON public.news_reporters TO service_role;
ALTER TABLE public.news_reporters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporters read own row" ON public.news_reporters FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Reporters apply for themselves" ON public.news_reporters FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update reporters" ON public.news_reporters FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER news_reporters_updated_at BEFORE UPDATE ON public.news_reporters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.news_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  excerpt text,
  body_markdown text NOT NULL DEFAULT '',
  cover_url text,
  proof_url text,
  proof_note text,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_submissions TO authenticated;
GRANT ALL ON public.news_submissions TO service_role;
ALTER TABLE public.news_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authors read own submissions" ON public.news_submissions FOR SELECT TO authenticated
  USING (auth.uid() = author_id OR public.is_admin(auth.uid()));
CREATE POLICY "Active reporters submit" ON public.news_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND EXISTS (
    SELECT 1 FROM public.news_reporters r WHERE r.user_id = auth.uid() AND r.status = 'active'
  ));
CREATE POLICY "Authors edit pending, admins edit all" ON public.news_submissions FOR UPDATE TO authenticated
  USING ((auth.uid() = author_id AND status = 'pending') OR public.is_admin(auth.uid()))
  WITH CHECK ((auth.uid() = author_id AND status = 'pending') OR public.is_admin(auth.uid()));
CREATE POLICY "Authors delete pending, admins delete all" ON public.news_submissions FOR DELETE TO authenticated
  USING ((auth.uid() = author_id AND status = 'pending') OR public.is_admin(auth.uid()));
CREATE TRIGGER news_submissions_updated_at BEFORE UPDATE ON public.news_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();