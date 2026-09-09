-- What a session is made of, once GoTrue stops making them for us.
--
-- Two tokens, because they answer two different needs. The access token is a
-- signed JWT: every request carries it, and the server verifies it with a key
-- rather than a query, so reads cost no round trip. That speed is bought by not
-- being revocable -- there is nothing to look up and therefore nothing to
-- cancel -- so it is deliberately short-lived.
--
-- The refresh token is the opposite: opaque, stored, single-use, and long-lived.
-- It is the only thing that can be taken away, which is what this table is for.

-- migrate:up

create table auth.refresh_tokens (
  token_id    uuid primary key default uuidv7(),
  user_id     uuid not null references auth.users(user_id) on delete cascade,

  -- The chain of tokens descending from one sign-in, and therefore in practice
  -- one device.
  --
  -- Rotation means each use consumes a token and issues its successor, so a
  -- sign-in produces a succession: A begets B begets C. Presenting a token that
  -- already carries used_at proves two copies of it exist -- a rotating token is
  -- usable once -- and there is no way to tell which holder is the legitimate
  -- one. So neither is trusted: the whole family is revoked, and only whoever
  -- knows the password comes back.
  --
  -- The family is the right granularity for that. Revoking the single reused
  -- token would leave its successor, already in the thief's hands, perfectly
  -- valid; revoking everything the account owns would sign the collector out of
  -- their phone because a token leaked from their laptop.
  family_id   uuid not null,

  -- The hash, never the token. A leak of this table must not hand out live
  -- sessions -- the same reasoning as for passwords.
  --
  -- SHA-256 rather than argon2id, and the difference matters: argon2 is slow on
  -- purpose because a password is short and guessable, and slowness is what
  -- makes guessing cost something. A refresh token is 32 random bytes, which no
  -- amount of guessing reaches, so there is nothing to slow down. Making a
  -- lookup on every refresh deliberately expensive would buy nothing.
  token_hash  text not null unique,

  expires_at  timestamptz not null,

  -- Null until spent. A timestamp rather than a boolean, because the moment of
  -- reuse is what an incident is reconstructed from.
  used_at     timestamptz,

  created_at  timestamptz not null default now()
);

-- Revoking a family, and signing out everywhere, are the two lookups that are
-- not by token_hash -- which the unique constraint already indexes.
create index refresh_tokens_family_idx on auth.refresh_tokens (family_id);
create index refresh_tokens_user_idx   on auth.refresh_tokens (user_id);

-- No row level security here, and that is not an omission.
--
-- Every other table is read by someone who has already proved who they are. This
-- one is read *in order to find that out*: a refresh arrives as a cookie and
-- nothing else, so there is no identity to filter by yet. The protection is the
-- grant below plus the fact that a row is only reachable by presenting the token
-- whose hash it holds.
grant select, insert, update, delete on auth.refresh_tokens to mynt_app;

-- ---------------------------------------------------------------------------
-- Every account gets its public half, without the server having to remember
-- ---------------------------------------------------------------------------

-- Signing up writes two rows in two schemas: the credentials in auth.users, and
-- the collector in public.user_info that every foreign key in the collection
-- points at. Nothing in the application may be allowed to do one without the
-- other -- an account with no user_info row can sign in and then fail on its
-- first insert, with a foreign key violation nobody would connect to sign-up.
--
-- So the database does it. The invariant is "these rows exist together", which
-- is a thing a database enforces and an application merely intends.
create function auth.attach_user_info() returns trigger
language plpgsql
-- SECURITY DEFINER because user_info is protected by a policy scoped to the
-- signed-in collector, and at this instant nobody is signed in -- the account is
-- three microseconds old. The function runs as the owner, so the policy does not
-- apply to it.
--
-- That is a genuine hole in the wall, and it is this narrow: the body takes no
-- argument, reads nothing from the caller, and can insert exactly one row whose
-- key is the account that just triggered it. There is nothing here to point
-- somewhere else.
security definer
-- Mandatory with SECURITY DEFINER. An empty search_path means every name below
-- is resolved explicitly, so a schema planted earlier on the path cannot supply
-- a different user_info.
set search_path = ''
as $$
begin
  insert into public.user_info (user_id) values (new.user_id);
  return new;
end
$$;

create trigger attach_user_info
  after insert on auth.users
  for each row execute function auth.attach_user_info();

-- migrate:down

drop trigger attach_user_info on auth.users;
drop function auth.attach_user_info();
revoke all on auth.refresh_tokens from mynt_app;
drop table auth.refresh_tokens;
