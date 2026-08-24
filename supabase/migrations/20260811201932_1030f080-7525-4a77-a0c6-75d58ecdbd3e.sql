ALTER TABLE public.match_chat_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

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
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));