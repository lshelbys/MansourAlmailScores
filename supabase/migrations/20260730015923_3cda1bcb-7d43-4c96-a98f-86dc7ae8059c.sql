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
ALTER PUBLICATION supabase_realtime ADD TABLE public.standing_labels;