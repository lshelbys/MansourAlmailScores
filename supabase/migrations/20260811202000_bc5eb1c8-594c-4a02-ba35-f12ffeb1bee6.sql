REVOKE EXECUTE ON FUNCTION public.grant_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_admin_unlock_attempt(uuid, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_unlock_allowed(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_standings(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_standings() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;