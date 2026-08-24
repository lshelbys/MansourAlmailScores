CREATE TABLE public.match_momentum (
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
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS momentum_minutes integer NOT NULL DEFAULT 90;