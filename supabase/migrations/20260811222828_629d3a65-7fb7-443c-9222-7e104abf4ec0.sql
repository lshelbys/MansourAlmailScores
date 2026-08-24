ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_match_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS match_notification_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.favorite_match_ids IS 'Matches explicitly saved by this user.';
COMMENT ON COLUMN public.profiles.match_notification_ids IS 'Matches with explicit notification overrides enabled by this user.';