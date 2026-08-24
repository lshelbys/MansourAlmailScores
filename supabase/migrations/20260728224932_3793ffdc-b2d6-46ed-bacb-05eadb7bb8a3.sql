
-- is_admin: switch to SECURITY INVOKER (admins table has authenticated SELECT policy)
CREATE OR REPLACE FUNCTION public.is_admin(_uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.admins WHERE user_id = _uid);
$$;

-- recompute_standings: keep DEFINER (trigger needs write) but drop authenticated grant; trigger runs regardless.
REVOKE EXECUTE ON FUNCTION public.recompute_standings(UUID) FROM authenticated;

-- trigger function should not be callable by clients directly
REVOKE EXECUTE ON FUNCTION public.trg_recompute_standings() FROM PUBLIC, anon, authenticated;
