REVOKE ALL ON FUNCTION public.chat_author_profiles(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_author_profiles(uuid[]) TO service_role;