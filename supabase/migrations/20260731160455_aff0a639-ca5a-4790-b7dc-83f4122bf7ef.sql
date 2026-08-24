DROP POLICY IF EXISTS "authenticated read admins" ON public.admins;
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
USING (true);