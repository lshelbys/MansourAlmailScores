ALTER TABLE public.competition_teams ADD COLUMN IF NOT EXISTS season text;
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.match_prediction_votes;