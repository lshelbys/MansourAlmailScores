CREATE POLICY "server manages admin unlock attempts"
ON public.admin_unlock_attempts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);