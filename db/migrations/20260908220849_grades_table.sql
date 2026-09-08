-- Condition grades become a table instead of an enum.
--
-- The enum was not broken: it sorted by declaration order for free, and adding
-- or renaming a value is one command even in the middle of the list. Only
-- removal is impossible -- "dropping an enum value is not implemented".
--
-- A table trades that free ordering for a join, and buys room. Grading scales
-- are national and are not translations of one another; the day this has to
-- record which scale a grade was assessed on, or map between them, a table
-- takes a column and an enum takes a rebuild.

-- migrate:up

create table grades (
  grade_code  text primary key,
  -- Worst to best. Gaps on purpose: slotting a grade between two others is then
  -- an insert rather than a renumbering of everything after it, which is the
  -- flexibility this table exists for.
  rank        smallint not null unique
);

-- The four that matter for circulating euros. The French scale also has B and
-- SPL; coins below TB are rarely worth cataloguing, and they can be added later
-- without touching anything else -- which is the point.
insert into grades (grade_code, rank) values
  ('VERY_FINE',          10),  -- fr: TB
  ('EXTREMELY_FINE',     20),  -- fr: TTB
  ('ABOUT_UNCIRCULATED', 30),  -- fr: SUP
  ('UNCIRCULATED',       40);  -- fr: FDC

-- Added, backfilled, then swapped, so no coin loses its grade on the way.
alter table coins add column grade_code text references grades(grade_code);
update coins set grade_code = grade::text where grade is not null;
alter table coins drop column grade;
drop type coin_grade;

-- Shared and read-only, like the rest of the catalog: said once as a grant and
-- once as a policy limited to SELECT, so neither alone is load-bearing.
alter table grades enable row level security;
create policy "read catalog" on grades for select to authenticated using (true);
grant select on grades to authenticated;

-- migrate:down

create type coin_grade as enum (
  'VERY_FINE', 'EXTREMELY_FINE', 'ABOUT_UNCIRCULATED', 'UNCIRCULATED'
);
alter table coins add column grade coin_grade;
update coins set grade = grade_code::coin_grade where grade_code is not null;
alter table coins drop column grade_code;
drop table grades;
