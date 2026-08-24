DROP POLICY IF EXISTS "admins read admin list" ON public.admins;
CREATE POLICY "admins read own status"
ON public.admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());