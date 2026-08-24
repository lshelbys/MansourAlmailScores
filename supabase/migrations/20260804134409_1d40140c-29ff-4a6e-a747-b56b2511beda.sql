ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS chairman text;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS title_ar text;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS excerpt_ar text;
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS body_markdown_ar text;