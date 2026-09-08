-- Who the user is, and how the database learns it.
--
-- Everything here was previously supplied by GoTrue, which created it in a
-- schema of its own without any of it appearing in this repository. Rebuilding
-- it by hand is the first step of owning authentication.

-- migrate:up

-- Case-insensitive text, so Rui@example.com and rui@example.com are one account
-- rather than two people wondering why the password no longer works.
create extension if not exists citext;

create schema auth;

-- Credentials live in their own schema, apart from the collection.
--
-- It is not decoration: nothing in public has any reason to reach here, so a
-- careless join or a chatty query log cannot drag a password hash along with a
-- list of coins. The application tables point at user_info instead, which holds
-- nothing secret.
create table auth.users (
  user_id            uuid primary key default uuidv7(),
  email              citext not null unique,
  password_hash      text not null,
  -- A timestamp rather than a boolean: one says whether, the other says when,
  -- and the second is never the one regretted.
  email_verified_at  timestamptz,
  created_at         timestamptz not null default now()
);

-- The same person, seen from the application side. One row per account, sharing
-- its key, and the target of every foreign key in the collection.
create table user_info (
  user_id     uuid primary key references auth.users(user_id) on delete cascade,
  nickname    text,
  created_at  timestamptz not null default now()
);

-- The identity of whoever is asking, read back inside a query.
--
-- A database connection has no identity -- it is a pipe, reused between people.
-- The server therefore states who it is at the start of every transaction, and
-- this function is how a row level security policy reads that statement back.
--
-- The `true` passed to current_setting means "missing is not an error". It is
-- what makes the whole arrangement fail safe: outside a transaction that set an
-- identity, this returns null, no policy matches, and the answer is zero rows
-- rather than an error -- or worse, everyone's rows.
create function auth.current_user_id() returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

-- migrate:down

drop function auth.current_user_id();
drop table user_info;
drop table auth.users;
drop schema auth;
