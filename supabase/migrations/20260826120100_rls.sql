-- Row Level Security is the isolation boundary between users. Writing the rule
-- once in the database and letting the engine enforce it makes the classic
-- multi-tenant bug -- one account seeing another's rows -- structurally
-- impossible.
--
-- Access control only, no business logic: anything functional encoded here
-- would have to be rewritten if the auth system ever changes.
--
-- auth.uid() is wrapped in a select so the planner evaluates it once per
-- statement instead of once per row.

alter table profile    enable row level security;
alter table binder     enable row level security;
alter table page       enable row level security;
alter table coin       enable row level security;
alter table country    enable row level security;
alter table coin_type  enable row level security;

create policy "own profile" on profile
  for all to authenticated
  using      (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "owner" on binder
  for all to authenticated
  using      (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "owner" on coin
  for all to authenticated
  using      (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "owner" on page
  for all to authenticated
  using (exists (
    select 1 from binder b
    where b.id = page.binder_id and b.profile_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from binder b
    where b.id = page.binder_id and b.profile_id = (select auth.uid())
  ));

-- Shared catalog: readable by any signed-in account, writable by none.
-- Scoped to authenticated rather than left open, so the anon role -- and thus
-- anyone holding the public key shipped in the bundle -- cannot read it.
create policy "read catalog" on country   for select to authenticated using (true);
create policy "read catalog" on coin_type for select to authenticated using (true);
