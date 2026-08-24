ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false;
ALTER TABLE public.news_reporters ADD COLUMN IF NOT EXISTS full_name text;