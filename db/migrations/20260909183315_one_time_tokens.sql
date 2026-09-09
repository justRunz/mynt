-- Links sent by email: confirm this address, choose a new password.
--
-- One table for both, because they are the same object -- a secret handed to
-- somebody through a channel we do not control, good once and not for long --
-- differing only in what it entitles the holder to do. Two tables would be two
-- sets of grants, two cleanups, and two places to forget to mark a token spent.
--
-- Separate from refresh_tokens despite the resemblance. A refresh token is the
-- session; these two are ways of *getting* one, and they are handed over by
-- email, which is a channel nobody controls: the message sits in a mailbox, it
-- is forwarded, it is read on a shared screen. Hence lifetimes measured in hours
-- rather than a month, and no rotation -- there is nothing to rotate, they are
-- spent once and gone.

-- migrate:up

create table auth.one_time_tokens (
  token_id    uuid primary key default uuidv7(),
  user_id     uuid not null references auth.users(user_id) on delete cascade,

  -- Text with a check rather than an enum. An enum sorts for free and can never
  -- lose a value -- "dropping an enum value is not implemented" -- and the
  -- grades table already went this way for exactly that reason.
  purpose     text not null check (purpose in ('EMAIL_VERIFICATION', 'PASSWORD_RESET')),

  -- The hash, never the token, on the same reasoning as refresh tokens: 32
  -- random bytes are not guessed, so a fast hash is the right one, and a leak of
  -- this table must not let anybody take over an account by following a link
  -- they read out of it.
  token_hash  text not null unique,

  expires_at  timestamptz not null,

  -- Null until spent. Kept rather than deleted on use, so a second click on the
  -- same link can be told apart from a link that never existed -- one is a
  -- person double-clicking, the other is worth noticing.
  used_at     timestamptz,

  created_at  timestamptz not null default now()
);

-- Issuing a new link revokes the outstanding ones for that purpose, which is a
-- lookup by (user, purpose) rather than by hash.
create index one_time_tokens_user_purpose_idx
  on auth.one_time_tokens (user_id, purpose);

-- No row level security, for the same reason refresh_tokens has none: this is
-- read in order to find out who is asking. The token in the link is the whole
-- credential, and the grant below is the entire reach of the role that reads it.
grant select, insert, update, delete on auth.one_time_tokens to mynt_app;

-- Resetting a password has to end every session the old one opened -- that is
-- most of the point of resetting it -- so the role needs to be able to remove
-- somebody's refresh tokens. It already can: the grant is in the refresh_tokens
-- migration. Noted here because it is now load-bearing for a second reason.

-- migrate:down

revoke all on auth.one_time_tokens from mynt_app;
drop table auth.one_time_tokens;
