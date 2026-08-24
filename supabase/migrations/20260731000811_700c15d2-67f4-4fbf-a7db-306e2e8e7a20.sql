-- position-based qualification labels
CREATE TABLE public.standings_position_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  group_label text,
  position int NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#2563eb',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, group_label, position)
);
GRANT SELECT ON public.standings_position_labels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standings_position_labels TO authenticated;
GRANT ALL ON public.standings_position_labels TO service_role;
ALTER TABLE public.standings_position_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "position labels public read" ON public.standings_position_labels FOR SELECT USING (true);
CREATE POLICY "position labels admin write" ON public.standings_position_labels FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER set_updated_at_spl BEFORE UPDATE ON public.standings_position_labels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- teams reusable across competitions
CREATE TABLE public.competition_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, team_id)
);
GRANT SELECT ON public.competition_teams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_teams TO authenticated;
GRANT ALL ON public.competition_teams TO service_role;
ALTER TABLE public.competition_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competition teams public read" ON public.competition_teams FOR SELECT USING (true);
CREATE POLICY "competition teams admin write" ON public.competition_teams FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.competition_teams (competition_id, team_id)
SELECT competition_id, id FROM public.teams WHERE competition_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- club page extras
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS description text;

ALTER PUBLICATION supabase_realtime ADD TABLE public.standings_position_labels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_teams;