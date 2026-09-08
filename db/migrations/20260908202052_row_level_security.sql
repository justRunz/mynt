-- The isolation boundary between accounts.
--
-- Written once here and enforced by the engine, which is what makes the classic
-- multi-tenant bug -- one account seeing another's rows -- structurally
-- impossible rather than merely avoided. A query for the collection carries no
-- user filter at all; Postgres adds one.
--
-- Access control only. Anything functional encoded here would have to be
-- rewritten the day the authentication system changes.

-- migrate:up

-- The switch. A policy on a table without this does nothing at all, and the
-- table stays wide open to anyone holding a grant.
--
-- The other half of the same switch matters just as much: once enabled, a role
-- with no applicable policy sees nothing. Deny by default, so forgetting a
-- policy produces an empty screen rather than a leak.
alter table user_info  enable row level security;
alter table binders    enable row level security;
alter table pages      enable row level security;
alter table coins      enable row level security;
alter table countries  enable row level security;
alter table coin_types enable row level security;

-- ---------------------------------------------------------------------------
-- Private data
-- ---------------------------------------------------------------------------

-- USING decides which existing rows are visible; WITH CHECK decides which rows
-- may be written. Both are needed and they are not the same rule: with USING
-- alone, a coin could be inserted carrying someone else's user_id -- invisible
-- ever after, but sitting in their collection.
--
-- current_user_id() is wrapped in a scalar subquery on purpose. A policy
-- expression is applied per row, and the planner does not reliably hoist the
-- call out of the loop; written as (select ...) it becomes an InitPlan,
-- evaluated once per statement.

create policy "own row" on user_info
  for all to authenticated
  using      (user_id = (select auth.current_user_id()))
  with check (user_id = (select auth.current_user_id()));

create policy "owner" on binders
  for all to authenticated
  using      (user_id = (select auth.current_user_id()))
  with check (user_id = (select auth.current_user_id()));

create policy "owner" on coins
  for all to authenticated
  using      (user_id = (select auth.current_user_id()))
  with check (user_id = (select auth.current_user_id()));

-- Pages carry no user_id: they belong to a binder, which belongs to someone.
-- Ownership is reachable by join rather than duplicated into a column that
-- could drift from it, so the policy does the join.
create policy "owner" on pages
  for all to authenticated
  using (exists (
    select 1 from binders b
    where b.binder_id = pages.binder_id
      and b.user_id = (select auth.current_user_id())
  ))
  with check (exists (
    select 1 from binders b
    where b.binder_id = pages.binder_id
      and b.user_id = (select auth.current_user_id())
  ));

-- ---------------------------------------------------------------------------
-- Shared catalog
-- ---------------------------------------------------------------------------

-- Readable by any signed-in account, writable by none: FOR SELECT and nothing
-- else, so no verb but reading has a policy and every other one is denied.
--
-- Updating the catalog is therefore a migration, run by the owner, who bypasses
-- these policies. There is no path from the application to these rows -- a bug
-- in a route cannot corrupt data shared by everyone.
--
-- Scoped to authenticated rather than left open, so a connection that has not
-- put the costume on cannot read it either.
create policy "read catalog" on countries   for select to authenticated using (true);
create policy "read catalog" on coin_types  for select to authenticated using (true);

-- migrate:down

drop policy "read catalog" on coin_types;
drop policy "read catalog" on countries;
drop policy "owner" on pages;
drop policy "owner" on coins;
drop policy "owner" on binders;
drop policy "own row" on user_info;

alter table coin_types disable row level security;
alter table countries  disable row level security;
alter table coins      disable row level security;
alter table pages      disable row level security;
alter table binders    disable row level security;
alter table user_info  disable row level security;
