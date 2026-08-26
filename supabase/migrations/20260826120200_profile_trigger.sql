-- Creates the profile row on sign-up.
-- security definer because the insert happens before auth.uid() resolves to
-- the new user, so it cannot pass its own RLS policy.
-- search_path is pinned to defeat search_path hijacking on a definer function.
create function public.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile (id, nickname)
  values (new.id, new.raw_user_meta_data ->> 'nickname');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile();
