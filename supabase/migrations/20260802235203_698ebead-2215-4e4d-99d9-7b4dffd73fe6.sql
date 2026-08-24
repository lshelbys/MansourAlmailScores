ALTER TABLE public.news_reporters
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS code_redeemed_at timestamptz;

ALTER TABLE public.news_reporters ALTER COLUMN access_code DROP DEFAULT;

CREATE TABLE IF NOT EXISTS public.team_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
  title_name text,
  titles integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.team_titles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_titles TO authenticated;
GRANT ALL ON public.team_titles TO service_role;

ALTER TABLE public.team_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_titles public read" ON public.team_titles FOR SELECT USING (true);
CREATE POLICY "team_titles admin write" ON public.team_titles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER team_titles_updated_at BEFORE UPDATE ON public.team_titles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();