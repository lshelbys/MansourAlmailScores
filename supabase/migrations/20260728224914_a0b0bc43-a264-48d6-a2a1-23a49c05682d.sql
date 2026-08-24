
-- ADMINS -----------------------------------------------------------
CREATE TABLE public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read admins" ON public.admins FOR SELECT TO authenticated USING (true);
-- Writes to admins only via SECURITY DEFINER server fns (service_role).

CREATE OR REPLACE FUNCTION public.is_admin(_uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.admins WHERE user_id = _uid);
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon, authenticated;

-- Shared admin-write policy helper (inline expression is simplest — we call is_admin in each policy)

-- COMPETITIONS -----------------------------------------------------
CREATE TABLE public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'football',
  country TEXT,
  category TEXT,
  logo_url TEXT,
  starts_on DATE,
  ends_on DATE,
  format TEXT NOT NULL DEFAULT 'league',
  season TEXT,
  description TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.competitions TO anon, authenticated;
GRANT ALL ON public.competitions TO service_role, authenticated;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read competitions" ON public.competitions FOR SELECT USING (true);
CREATE POLICY "admin write competitions" ON public.competitions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- TEAMS ------------------------------------------------------------
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT,
  country TEXT,
  logo_url TEXT,
  coach_name TEXT,
  coach_photo_url TEXT,
  venue_name TEXT,
  venue_city TEXT,
  group_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX teams_comp_idx ON public.teams(competition_id);
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT ALL ON public.teams TO service_role, authenticated;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "admin write teams" ON public.teams FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- PLAYERS ----------------------------------------------------------
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT,
  shirt_number INT,
  height_cm INT,
  dob DATE,
  nationality TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX players_team_idx ON public.players(team_id);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role, authenticated;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "admin write players" ON public.players FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- MATCHES ----------------------------------------------------------
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  round TEXT,
  home_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  away_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  kickoff_at TIMESTAMPTZ,
  venue TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | live | ht | ft | aet | pen | postponed | cancelled | awarded | interrupted
  live_minute INT,
  home_score INT,
  away_score INT,
  home_pen INT,
  away_pen INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX matches_comp_idx ON public.matches(competition_id);
CREATE INDEX matches_kickoff_idx ON public.matches(kickoff_at);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role, authenticated;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "admin write matches" ON public.matches FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- MATCH EVENTS -----------------------------------------------------
CREATE TABLE public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  minute INT,
  extra INT,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  assist_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  sub_out_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- goal | own_goal | penalty | missed_penalty | yellow | red | second_yellow | sub | var
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX match_events_match_idx ON public.match_events(match_id);
GRANT SELECT ON public.match_events TO anon, authenticated;
GRANT ALL ON public.match_events TO service_role, authenticated;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read match_events" ON public.match_events FOR SELECT USING (true);
CREATE POLICY "admin write match_events" ON public.match_events FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- LINEUPS ----------------------------------------------------------
CREATE TABLE public.match_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  is_starting BOOLEAN NOT NULL DEFAULT true,
  position_code TEXT,
  shirt_number INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id)
);
CREATE INDEX match_lineups_match_idx ON public.match_lineups(match_id);
GRANT SELECT ON public.match_lineups TO anon, authenticated;
GRANT ALL ON public.match_lineups TO service_role, authenticated;
ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read match_lineups" ON public.match_lineups FOR SELECT USING (true);
CREATE POLICY "admin write match_lineups" ON public.match_lineups FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- STANDINGS --------------------------------------------------------
CREATE TABLE public.standings_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  group_label TEXT,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  played INT NOT NULL DEFAULT 0,
  won INT NOT NULL DEFAULT 0,
  drawn INT NOT NULL DEFAULT 0,
  lost INT NOT NULL DEFAULT 0,
  gf INT NOT NULL DEFAULT 0,
  ga INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  points_adjust INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  qualification_label TEXT,
  qualification_color TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(competition_id, team_id)
);
CREATE INDEX standings_comp_idx ON public.standings_rows(competition_id);
GRANT SELECT ON public.standings_rows TO anon, authenticated;
GRANT ALL ON public.standings_rows TO service_role, authenticated;
ALTER TABLE public.standings_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read standings" ON public.standings_rows FOR SELECT USING (true);
CREATE POLICY "admin write standings" ON public.standings_rows FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- NEWS -------------------------------------------------------------
CREATE TABLE public.news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  cover_url TEXT,
  body_markdown TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  author_display TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX news_published_idx ON public.news_posts(published_at DESC);
GRANT SELECT ON public.news_posts TO anon, authenticated;
GRANT ALL ON public.news_posts TO service_role, authenticated;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read news" ON public.news_posts FOR SELECT USING (true);
CREATE POLICY "admin write news" ON public.news_posts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Updated_at triggers
CREATE TRIGGER competitions_updated BEFORE UPDATE ON public.competitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER players_updated BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER matches_updated BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER standings_updated BEFORE UPDATE ON public.standings_rows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER news_updated BEFORE UPDATE ON public.news_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Standings auto-recompute
CREATE OR REPLACE FUNCTION public.recompute_standings(_comp UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Reset counters for all rows in comp (keep manual adjustments and labels)
  UPDATE public.standings_rows SET played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, points = 0
   WHERE competition_id = _comp;
  -- Aggregate from finished matches
  WITH finished AS (
    SELECT * FROM public.matches
     WHERE competition_id = _comp
       AND status IN ('ft','aet','pen','awarded')
       AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
       AND home_score IS NOT NULL AND away_score IS NOT NULL
  ), sides AS (
    SELECT home_team_id AS team_id, home_score AS gf, away_score AS ga FROM finished
    UNION ALL
    SELECT away_team_id AS team_id, away_score AS gf, home_score AS ga FROM finished
  ), agg AS (
    SELECT team_id,
      COUNT(*) AS played,
      COUNT(*) FILTER (WHERE gf > ga) AS won,
      COUNT(*) FILTER (WHERE gf = ga) AS drawn,
      COUNT(*) FILTER (WHERE gf < ga) AS lost,
      COALESCE(SUM(gf),0) AS gf,
      COALESCE(SUM(ga),0) AS ga
    FROM sides GROUP BY team_id
  )
  UPDATE public.standings_rows sr SET
    played = a.played, won = a.won, drawn = a.drawn, lost = a.lost,
    gf = a.gf, ga = a.ga,
    points = a.won * 3 + a.drawn
  FROM agg a
  WHERE sr.competition_id = _comp AND sr.team_id = a.team_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.recompute_standings(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_standings(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_recompute_standings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_standings(COALESCE(NEW.competition_id, OLD.competition_id));
  RETURN NEW;
END; $$;
CREATE TRIGGER matches_recompute AFTER INSERT OR UPDATE OR DELETE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_standings();

-- Admin unlock server-side (password checked in server fn, this just adds row)
CREATE OR REPLACE FUNCTION public.grant_admin(_uid UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.admins(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
$$;
REVOKE EXECUTE ON FUNCTION public.grant_admin(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin(UUID) TO service_role;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.competitions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_lineups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.standings_rows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_posts;

-- Seed the World Cup 2026 competition (admin edits from UI later)
INSERT INTO public.competitions (slug, name, sport, country, category, format, season, starts_on, ends_on, featured, sort_order, description)
VALUES ('world-cup-2026', 'FIFA World Cup 2026', 'football', 'USA · Canada · Mexico', 'International', 'groups_knockout', '2026',
        '2026-06-11', '2026-07-19', true, 0,
        'The 23rd FIFA World Cup, hosted across 16 cities in the United States, Canada, and Mexico. First edition with 48 teams.');
