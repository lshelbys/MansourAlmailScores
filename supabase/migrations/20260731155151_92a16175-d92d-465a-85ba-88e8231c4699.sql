-- Column additions
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
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_stats;