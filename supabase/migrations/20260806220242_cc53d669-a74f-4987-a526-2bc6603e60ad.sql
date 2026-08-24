revoke execute on function public.chat_author_profiles(uuid[]) from anon;

create or replace function public.chat_author_profiles(_ids uuid[])
returns table(id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url
  from public.profiles p
  where p.id = any(_ids)
    and exists (select 1 from public.match_chat_messages m where m.user_id = p.id)
$$;