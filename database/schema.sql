
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  language text NOT NULL DEFAULT 'en',
  theme text NOT NULL DEFAULT 'dark',
  notification_preferences jsonb NOT NULL DEFAULT '{"match_start": true, "goals": true, "final_result": true, "news": false}'::jsonb,
  favorite_team_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  favorite_player_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  favorite_competition_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE POLICY "Users read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
DROP POLICY IF EXISTS "Users read avatars" ON storage.objects;
CREATE POLICY "Users read own avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
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

-- is_admin: switch to SECURITY INVOKER (admins table has authenticated SELECT policy)
CREATE OR REPLACE FUNCTION public.is_admin(_uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.admins WHERE user_id = _uid);
$$;

-- recompute_standings: keep DEFINER (trigger needs write) but drop authenticated grant; trigger runs regardless.
REVOKE EXECUTE ON FUNCTION public.recompute_standings(UUID) FROM authenticated;

-- trigger function should not be callable by clients directly
REVOKE EXECUTE ON FUNCTION public.trg_recompute_standings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_standings(UUID) FROM PUBLIC, anon;
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
-- VENUES
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.venues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read venues" ON public.venues FOR SELECT USING (true);
CREATE POLICY "admin write venues" ON public.venues FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE UNIQUE INDEX venues_name_city_key ON public.venues (lower(name), coalesce(lower(city), ''));

-- COACHES
CREATE TABLE public.coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  name text NOT NULL,
  dob date,
  nationality text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coaches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaches TO authenticated;
GRANT ALL ON public.coaches TO service_role;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read coaches" ON public.coaches FOR SELECT USING (true);
CREATE POLICY "admin write coaches" ON public.coaches FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER coaches_updated_at BEFORE UPDATE ON public.coaches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TRANSFERS (players and coaches)
CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type text NOT NULL DEFAULT 'player',
  person_id uuid NOT NULL,
  from_club text,
  to_club text,
  moved_on date,
  fee text,
  transfer_type text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transfers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read transfers" ON public.transfers FOR SELECT USING (true);
CREATE POLICY "admin write transfers" ON public.transfers FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX transfers_person_idx ON public.transfers (person_type, person_id);

-- SAVED STANDING LABELS
CREATE TABLE public.standing_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES public.competitions(id) ON DELETE CASCADE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.standing_labels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standing_labels TO authenticated;
GRANT ALL ON public.standing_labels TO service_role;
ALTER TABLE public.standing_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read standing labels" ON public.standing_labels FOR SELECT USING (true);
CREATE POLICY "admin write standing labels" ON public.standing_labels FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE UNIQUE INDEX standing_labels_key ON public.standing_labels (coalesce(competition_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(label));

-- COLUMN ADDITIONS
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS market_value text,
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS timer_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS timer_elapsed_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timer_running boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lineup_mode text NOT NULL DEFAULT 'list',
  ADD COLUMN IF NOT EXISTS home_formation text,
  ADD COLUMN IF NOT EXISTS away_formation text;

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS standings_mode text NOT NULL DEFAULT 'table',
  ADD COLUMN IF NOT EXISTS country_code text;

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS nationality_code text;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS nationality_code text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_unit text NOT NULL DEFAULT 'cm';

ALTER PUBLICATION supabase_realtime ADD TABLE public.venues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coaches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.standing_labels;-- position-based qualification labels
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
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_teams;-- Column additions
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS founded_on date;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS capacity integer;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS title_holder_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS higher_division_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS lower_division_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS seasons text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS parent_competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL;

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS referee text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS highlight_url text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS round_number integer;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS lineups_published boolean NOT NULL DEFAULT false;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL;

ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS season text;

-- Broadcast channels
CREATE TABLE IF NOT EXISTS public.broadcast_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  country_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.broadcast_channels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_channels TO authenticated;
GRANT ALL ON public.broadcast_channels TO service_role;
ALTER TABLE public.broadcast_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read channels" ON public.broadcast_channels FOR SELECT USING (true);
CREATE POLICY "admin write channels" ON public.broadcast_channels FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Match broadcasts
CREATE TABLE IF NOT EXISTS public.match_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.broadcast_channels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, channel_id)
);
GRANT SELECT ON public.match_broadcasts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_broadcasts TO authenticated;
GRANT ALL ON public.match_broadcasts TO service_role;
ALTER TABLE public.match_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read match broadcasts" ON public.match_broadcasts FOR SELECT USING (true);
CREATE POLICY "admin write match broadcasts" ON public.match_broadcasts FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Match chat
CREATE TABLE IF NOT EXISTS public.match_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_chat_messages_match_idx ON public.match_chat_messages(match_id, created_at);
GRANT SELECT ON public.match_chat_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_chat_messages TO authenticated;
GRANT ALL ON public.match_chat_messages TO service_role;
ALTER TABLE public.match_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read chat" ON public.match_chat_messages FOR SELECT USING (true);
CREATE POLICY "signed in insert chat" ON public.match_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete chat" ON public.match_chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Player ratings
CREATE TABLE IF NOT EXISTS public.player_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  competition_id uuid REFERENCES public.competitions(id) ON DELETE CASCADE,
  rating numeric(3,1) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_ratings TO authenticated;
GRANT ALL ON public.player_ratings TO service_role;
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ratings" ON public.player_ratings FOR SELECT USING (true);
CREATE POLICY "admin write ratings" ON public.player_ratings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Media items
CREATE TABLE IF NOT EXISTS public.media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('player','team','match','competition','venue','coach')),
  owner_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload','youtube','facebook','instagram','tiktok','x','other')),
  url text NOT NULL,
  title text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_items_owner_idx ON public.media_items(owner_type, owner_id, sort_order);
GRANT SELECT ON public.media_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_items TO authenticated;
GRANT ALL ON public.media_items TO service_role;
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read media" ON public.media_items FOR SELECT USING (true);
CREATE POLICY "admin write media" ON public.media_items FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Competition awards
CREATE TABLE IF NOT EXISTS public.competition_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  award_type text NOT NULL CHECK (award_type IN ('player_of_round','player_of_season')),
  round_number integer,
  season text,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.competition_awards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_awards TO authenticated;
GRANT ALL ON public.competition_awards TO service_role;
ALTER TABLE public.competition_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read awards" ON public.competition_awards FOR SELECT USING (true);
CREATE POLICY "admin write awards" ON public.competition_awards FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Match stats
CREATE TABLE IF NOT EXISTS public.match_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  label text NOT NULL,
  home_value text,
  away_value text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.match_stats TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_stats TO authenticated;
GRANT ALL ON public.match_stats TO service_role;
ALTER TABLE public.match_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read match stats" ON public.match_stats FOR SELECT USING (true);
CREATE POLICY "admin write match stats" ON public.match_stats FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Match predictions
CREATE TABLE IF NOT EXISTS public.match_predictions (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  home_percent integer NOT NULL DEFAULT 33,
  draw_percent integer NOT NULL DEFAULT 34,
  away_percent integer NOT NULL DEFAULT 33,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.match_predictions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_predictions TO authenticated;
GRANT ALL ON public.match_predictions TO service_role;
ALTER TABLE public.match_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read predictions" ON public.match_predictions FOR SELECT USING (true);
CREATE POLICY "admin write predictions" ON public.match_predictions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Translation cache
CREATE TABLE IF NOT EXISTS public.translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale text NOT NULL,
  source_text text NOT NULL,
  translated_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, source_text)
);
GRANT SELECT ON public.translations TO anon;
GRANT SELECT, INSERT ON public.translations TO authenticated;
GRANT ALL ON public.translations TO service_role;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read translations" ON public.translations FOR SELECT USING (true);

-- updated_at triggers
CREATE TRIGGER trg_channels_updated BEFORE UPDATE ON public.broadcast_channels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ratings_updated BEFORE UPDATE ON public.player_ratings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_awards_updated BEFORE UPDATE ON public.competition_awards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_venues_updated BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_stats;DROP POLICY IF EXISTS "authenticated read admins" ON public.admins;
CREATE POLICY "admins read admin list"
ON public.admins
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "read chat" ON public.match_chat_messages;
CREATE POLICY "authenticated users read chat"
ON public.match_chat_messages
FOR SELECT
TO authenticated
USING (true);REVOKE ALL ON FUNCTION public.grant_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = _uid
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = _uid
  );
$$;DROP POLICY IF EXISTS "admins read admin list" ON public.admins;
CREATE POLICY "admins read own status"
ON public.admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());CREATE TABLE public.admin_unlock_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.admin_unlock_attempts TO service_role;
ALTER TABLE public.admin_unlock_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX admin_unlock_attempts_user_time_idx
ON public.admin_unlock_attempts (user_id, attempted_at DESC);

CREATE OR REPLACE FUNCTION public.admin_unlock_allowed(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) FILTER (WHERE NOT succeeded) < 5
  FROM public.admin_unlock_attempts
  WHERE user_id = _uid
    AND attempted_at >= now() - interval '15 minutes';
$$;

CREATE OR REPLACE FUNCTION public.record_admin_unlock_attempt(_uid uuid, _succeeded boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.admin_unlock_attempts (user_id, succeeded)
  VALUES (_uid, _succeeded);
$$;

CREATE OR REPLACE FUNCTION public.revoke_admin(_uid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.admins WHERE user_id = _uid;
$$;

REVOKE ALL ON FUNCTION public.admin_unlock_allowed(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_admin_unlock_attempt(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlock_allowed(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_admin_unlock_attempt(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_admin(uuid) TO service_role;CREATE POLICY "server manages admin unlock attempts"
ON public.admin_unlock_attempts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);-- 1. Seasons within a tournament
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
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();ALTER TABLE public.news_reporters
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
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS chairman text;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS title_ar text;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS excerpt_ar text;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS body_markdown_ar text;DROP POLICY IF EXISTS "read news" ON public.news_posts;
CREATE POLICY "read published news" ON public.news_posts FOR SELECT TO anon, authenticated
  USING (published_at IS NOT NULL AND published_at <= now());
CREATE POLICY "admins read all news" ON public.news_posts FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false;
ALTER TABLE public.news_reporters ADD COLUMN IF NOT EXISTS full_name text;create or replace function public.chat_author_profiles(_ids uuid[])
returns table(id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url
  from public.profiles p
  where p.id = any(_ids)
$$;

grant execute on function public.chat_author_profiles(uuid[]) to authenticated, anon;revoke execute on function public.chat_author_profiles(uuid[]) from anon;

create or replace function public.chat_author_profiles(_ids uuid[])
returns table(id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url
  from public.profiles p
  where p.id = any(_ids)
    and exists (select 1 from public.match_chat_messages m where m.user_id = p.id)
$$;DROP POLICY IF EXISTS "Active reporters submit" ON public.news_submissions;
CREATE POLICY "Active reporters submit" ON public.news_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND EXISTS (
    SELECT 1 FROM public.news_reporters r WHERE r.user_id = auth.uid() AND r.status IN ('active','approved')
  ));ALTER TABLE public.match_chat_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

DROP POLICY IF EXISTS "own update chat" ON public.match_chat_messages;
CREATE POLICY "own update chat" ON public.match_chat_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_chat_messages TO authenticated;

CREATE TABLE IF NOT EXISTS public.match_chat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.match_chat_messages(id) ON DELETE SET NULL,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id uuid,
  message_body text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_chat_reports TO authenticated;
GRANT ALL ON public.match_chat_reports TO service_role;

ALTER TABLE public.match_chat_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report own insert" ON public.match_chat_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "report read own or admin" ON public.match_chat_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.is_admin(auth.uid()));
CREATE POLICY "report admin update" ON public.match_chat_reports
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "report admin delete" ON public.match_chat_reports
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));REVOKE EXECUTE ON FUNCTION public.grant_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_admin_unlock_attempt(uuid, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_unlock_allowed(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_standings(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_standings() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_match_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS match_notification_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.favorite_match_ids IS 'Matches explicitly saved by this user.';
COMMENT ON COLUMN public.profiles.match_notification_ids IS 'Matches with explicit notification overrides enabled by this user.';REVOKE ALL ON FUNCTION public.chat_author_profiles(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_author_profiles(uuid[]) TO service_role;ALTER TABLE public.competition_teams ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE public.competition_teams DROP CONSTRAINT IF EXISTS competition_teams_competition_id_team_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS competition_teams_unique_season ON public.competition_teams (competition_id, team_id, COALESCE(season, ''));

CREATE TABLE IF NOT EXISTS public.match_prediction_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_prediction_votes TO authenticated;
GRANT SELECT ON public.match_prediction_votes TO anon;
GRANT ALL ON public.match_prediction_votes TO service_role;

ALTER TABLE public.match_prediction_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prediction votes public read" ON public.match_prediction_votes FOR SELECT USING (true);
CREATE POLICY "prediction votes insert own" ON public.match_prediction_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND choice IN ('home','draw','away'));
CREATE POLICY "prediction votes update own" ON public.match_prediction_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND choice IN ('home','draw','away'));
CREATE POLICY "prediction votes delete own" ON public.match_prediction_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER match_prediction_votes_updated_at BEFORE UPDATE ON public.match_prediction_votes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.match_prediction_votes;CREATE OR REPLACE FUNCTION public.recompute_standings(_comp uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.standings_rows SET played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, points = 0
   WHERE competition_id = _comp;

  WITH finished AS (
    SELECT * FROM public.matches
     WHERE competition_id = _comp
       AND status IN ('ft','aet','pen','awarded')
       AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
       AND home_score IS NOT NULL AND away_score IS NOT NULL
  ), sides AS (
    SELECT home_team_id AS team_id, season, home_score AS gf, away_score AS ga FROM finished
    UNION ALL
    SELECT away_team_id AS team_id, season, away_score AS gf, home_score AS ga FROM finished
  ), agg AS (
    SELECT team_id, season,
      COUNT(*) AS played,
      COUNT(*) FILTER (WHERE gf > ga) AS won,
      COUNT(*) FILTER (WHERE gf = ga) AS drawn,
      COUNT(*) FILTER (WHERE gf < ga) AS lost,
      COALESCE(SUM(gf),0) AS gf,
      COALESCE(SUM(ga),0) AS ga
    FROM sides GROUP BY team_id, season
  )
  UPDATE public.standings_rows sr SET
    played = a.played, won = a.won, drawn = a.drawn, lost = a.lost,
    gf = a.gf, ga = a.ga,
    points = a.won * 3 + a.drawn
  FROM agg a
  WHERE sr.competition_id = _comp
    AND sr.team_id = a.team_id
    AND (sr.season IS NOT DISTINCT FROM a.season OR sr.season IS NULL OR a.season IS NULL);

  -- Re-rank each group/season by points, goal difference, goals scored
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY competition_id, COALESCE(group_label,''), COALESCE(season,'')
      ORDER BY (points + points_adjust) DESC, (gf - ga) DESC, gf DESC, played ASC
    ) AS rn
    FROM public.standings_rows WHERE competition_id = _comp
  )
  UPDATE public.standings_rows sr SET sort_order = r.rn
  FROM ranked r WHERE sr.id = r.id;
END;
$$;ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS result_only boolean NOT NULL DEFAULT false;CREATE TABLE public.match_momentum (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  minute integer NOT NULL,
  value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, minute)
);
GRANT SELECT ON public.match_momentum TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_momentum TO authenticated;
GRANT ALL ON public.match_momentum TO service_role;
ALTER TABLE public.match_momentum ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read match momentum" ON public.match_momentum FOR SELECT USING (true);
CREATE POLICY "admin write match momentum" ON public.match_momentum FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS momentum_minutes integer NOT NULL DEFAULT 90;ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_national boolean NOT NULL DEFAULT false;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS is_national boolean NOT NULL DEFAULT false;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS birth_place text;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS appointed_on date;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS contract_until date;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS trophies integer NOT NULL DEFAULT 0;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS preferred_formation text;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS bio text;

CREATE TABLE IF NOT EXISTS public.national_team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  shirt_number integer,
  photo_url text,
  position text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, player_id)
);
GRANT SELECT ON public.national_team_players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.national_team_players TO authenticated;
GRANT ALL ON public.national_team_players TO service_role;
ALTER TABLE public.national_team_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read national call-ups" ON public.national_team_players FOR SELECT USING (true);
CREATE POLICY "admin write national call-ups" ON public.national_team_players FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS national_team_players_player_idx ON public.national_team_players(player_id);

INSERT INTO public.teams (name, country, country_code, logo_url, is_national)
SELECT split_part(v, '|', 2), split_part(v, '|', 2), split_part(v, '|', 1),
       'https://flagcdn.com/w160/' || lower(split_part(v, '|', 1)) || '.png', true
FROM unnest(string_to_array('AF|Afghanistan,AU|Australia,BH|Bahrain,BD|Bangladesh,BT|Bhutan,BN|Brunei,KH|Cambodia,CN|China,TW|Chinese Taipei,GU|Guam,HK|Hong Kong,IN|India,ID|Indonesia,IR|Iran,IQ|Iraq,JP|Japan,JO|Jordan,KW|Kuwait,KG|Kyrgyzstan,LA|Laos,LB|Lebanon,MO|Macau,MY|Malaysia,MV|Maldives,MN|Mongolia,MM|Myanmar,NP|Nepal,KP|North Korea,OM|Oman,PK|Pakistan,PS|Palestine,PH|Philippines,QA|Qatar,SA|Saudi Arabia,SG|Singapore,KR|South Korea,LK|Sri Lanka,SY|Syria,TJ|Tajikistan,TH|Thailand,TL|Timor-Leste,TM|Turkmenistan,AE|United Arab Emirates,UZ|Uzbekistan,VN|Vietnam,YE|Yemen,DZ|Algeria,AO|Angola,BJ|Benin,BW|Botswana,BF|Burkina Faso,BI|Burundi,CM|Cameroon,CV|Cape Verde,CF|Central African Republic,TD|Chad,KM|Comoros,CG|Congo,CD|DR Congo,DJ|Djibouti,EG|Egypt,GQ|Equatorial Guinea,ER|Eritrea,SZ|Eswatini,ET|Ethiopia,GA|Gabon,GM|Gambia,GH|Ghana,GN|Guinea,GW|Guinea-Bissau,CI|Ivory Coast,KE|Kenya,LS|Lesotho,LR|Liberia,LY|Libya,MG|Madagascar,MW|Malawi,ML|Mali,MR|Mauritania,MU|Mauritius,MA|Morocco,MZ|Mozambique,NA|Namibia,NE|Niger,NG|Nigeria,RW|Rwanda,ST|Sao Tome and Principe,SN|Senegal,SC|Seychelles,SL|Sierra Leone,SO|Somalia,ZA|South Africa,SS|South Sudan,SD|Sudan,TZ|Tanzania,TG|Togo,TN|Tunisia,UG|Uganda,ZM|Zambia,ZW|Zimbabwe,AI|Anguilla,AG|Antigua and Barbuda,AW|Aruba,BS|Bahamas,BB|Barbados,BZ|Belize,BM|Bermuda,VG|British Virgin Islands,CA|Canada,KY|Cayman Islands,CR|Costa Rica,CU|Cuba,CW|Curacao,DM|Dominica,DO|Dominican Republic,SV|El Salvador,GD|Grenada,GT|Guatemala,GY|Guyana,HT|Haiti,HN|Honduras,JM|Jamaica,MX|Mexico,MS|Montserrat,NI|Nicaragua,PA|Panama,PR|Puerto Rico,KN|St Kitts and Nevis,LC|St Lucia,VC|St Vincent and the Grenadines,SR|Suriname,TT|Trinidad and Tobago,TC|Turks and Caicos Islands,US|United States,VI|US Virgin Islands,SX|Sint Maarten,AR|Argentina,BO|Bolivia,BR|Brazil,CL|Chile,CO|Colombia,EC|Ecuador,PY|Paraguay,PE|Peru,UY|Uruguay,VE|Venezuela,AS|American Samoa,CK|Cook Islands,FJ|Fiji,NC|New Caledonia,NZ|New Zealand,PG|Papua New Guinea,WS|Samoa,SB|Solomon Islands,TO|Tonga,VU|Vanuatu,AL|Albania,AD|Andorra,AM|Armenia,AT|Austria,AZ|Azerbaijan,BY|Belarus,BE|Belgium,BA|Bosnia and Herzegovina,BG|Bulgaria,HR|Croatia,CY|Cyprus,CZ|Czechia,DK|Denmark,GB-ENG|England,EE|Estonia,FO|Faroe Islands,FI|Finland,FR|France,GE|Georgia,DE|Germany,GI|Gibraltar,GR|Greece,HU|Hungary,IS|Iceland,IL|Israel,IT|Italy,KZ|Kazakhstan,XK|Kosovo,LV|Latvia,LI|Liechtenstein,LT|Lithuania,LU|Luxembourg,MT|Malta,MD|Moldova,ME|Montenegro,NL|Netherlands,MK|North Macedonia,GB-NIR|Northern Ireland,NO|Norway,PL|Poland,PT|Portugal,IE|Ireland,RO|Romania,RU|Russia,SM|San Marino,GB-SCT|Scotland,RS|Serbia,SK|Slovakia,SI|Slovenia,ES|Spain,SE|Sweden,CH|Switzerland,TR|Turkiye,UA|Ukraine,GB-WLS|Wales', ',')) AS v
WHERE NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.is_national AND t.country_code = split_part(v, '|', 1));