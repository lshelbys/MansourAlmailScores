CREATE TABLE public.admin_unlock_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.admin_unlock_attempts TO service_role;
ALTER TABLE public.admin_unlock_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX admin_unlock_attempts_user_time_idx
ON public.admin_unlock_attempts (user_id, attempted_at DESC);

CREATE OR REPLACE FUNCTION public.admin_unlock_allowed(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) FILTER (WHERE NOT succeeded) < 5
  FROM public.admin_unlock_attempts
  WHERE user_id = _uid
    AND attempted_at >= now() - interval '15 minutes';
$$;

CREATE OR REPLACE FUNCTION public.record_admin_unlock_attempt(_uid uuid, _succeeded boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.admin_unlock_attempts (user_id, succeeded)
  VALUES (_uid, _succeeded);
$$;

CREATE OR REPLACE FUNCTION public.revoke_admin(_uid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.admins WHERE user_id = _uid;
$$;

REVOKE ALL ON FUNCTION public.admin_unlock_allowed(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_admin_unlock_attempt(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlock_allowed(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_admin_unlock_attempt(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_admin(uuid) TO service_role;