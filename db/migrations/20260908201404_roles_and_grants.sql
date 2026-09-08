-- The two roles the whole isolation scheme rests on.
--
-- Supabase created these without ever showing them. Writing them by hand is how
-- the trap underneath becomes visible: **a table's owner bypasses row level
-- security**, silently and by design. If the server connected as the role that
-- created these tables, a forgotten wrapper would return everyone's rows
-- instead of none.

-- migrate:up

-- Guarded rather than plain CREATE ROLE: roles live in the cluster, not in the
-- database, so they survive `dbmate drop` and would already exist on the second
-- reset. Postgres has no CREATE ROLE IF NOT EXISTS.
do $$
begin
  -- A costume, not an account. NOLOGIN means nobody ever connects as this --
  -- it is worn with SET LOCAL ROLE for the length of one transaction, and
  -- falls off at commit. Every policy below targets it.
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  -- The identity in the server's connection string. It owns nothing, so row
  -- level security applies to it in full.
  --
  -- No password here: that is environment-specific and does not belong in a
  -- file tracked by git. Local development sets one with `pnpm db:password`,
  -- production through Dokploy.
  if not exists (select 1 from pg_roles where rolname = 'mynt_app') then
    create role mynt_app login;
  end if;
end $$;

-- Asserted rather than assumed. The guarded blocks above only run on a cluster
-- that has never seen these roles; these two lines hold whether the role was
-- just created or predates this migration.
alter role authenticated nologin;

-- Sets the default for any membership granted from here on. It is not what
-- makes the line below work, but leaving the role's own default at INHERIT
-- would make the next GRANT silently permissive.
alter role mynt_app noinherit;

-- WITH INHERIT FALSE is the load-bearing part, and it has to be said here
-- rather than on the role.
--
-- Since Postgres 16 a membership carries its own inherit option, recorded from
-- the member's default at GRANT time; ALTER ROLE ... NOINHERIT afterwards only
-- affects future memberships, never this one. Said only on the role, mynt_app
-- would read the collection without ever wearing the costume -- seeing nothing,
-- because the policy still matches through membership and current_user_id() is
-- null outside a scoped transaction, but failing as a silent empty result
-- instead of a refusal.
--
-- Stated this way, the grant conveys the right to SET ROLE and nothing else:
-- no privilege arrives until the costume is actually on.
grant authenticated to mynt_app with inherit false;

-- ---------------------------------------------------------------------------
-- What the costume may touch
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

-- Schema usage only, so policies can call current_user_id(). It carries no
-- access to auth.users, which is granted to nobody below.
grant usage on schema auth to authenticated;
grant execute on function auth.current_user_id() to authenticated;

-- The collection. Row level security narrows these to one person's rows; the
-- grant only says which verbs exist at all.
grant select, insert, update, delete on user_info, binders, pages, coins to authenticated;

-- The catalog is shared and read-only. Said twice on purpose -- here, and again
-- as a policy limited to SELECT -- so neither alone is load-bearing.
grant select on countries, coin_types to authenticated;

-- ---------------------------------------------------------------------------
-- What the server may touch without wearing it
-- ---------------------------------------------------------------------------

-- Signing in cannot be scoped to a user: the password is checked before anyone
-- knows who is asking. Those routes therefore reach the database unscoped, and
-- this grant is the whole extent of what unscoped can do.
grant usage on schema auth to mynt_app;
grant select, insert, update on auth.users to mynt_app;

-- Deliberately absent: any privilege for mynt_app on coins, binders, pages or
-- user_info. Combined with NOINHERIT, an unscoped query against the collection
-- does not return zero rows -- it fails outright with "permission denied for
-- table coins", on the first attempt, in development.

-- migrate:down

revoke all on auth.users from mynt_app;
revoke all on schema auth from mynt_app;
revoke all on user_info, binders, pages, coins, countries, coin_types from authenticated;
revoke all on schema public, auth from authenticated;
revoke execute on function auth.current_user_id() from authenticated;
revoke authenticated from mynt_app;

-- The roles themselves are left in place: they are cluster-wide, other
-- databases in the same cluster may hold objects owned by them, and dropping a
-- role that still owns something fails anyway.
