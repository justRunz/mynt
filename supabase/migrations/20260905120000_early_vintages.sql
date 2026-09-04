-- The first euro coins were struck before the currency existed.
--
-- Five of the twelve founding countries dated their first mintings with the
-- year they were actually struck rather than 2002: Belgium, Spain, Finland,
-- France and the Netherlands all have coins reading 1999, 2000 or 2001. They
-- circulated from day one and sit in collections today, and the catalog had no
-- room for them -- the add form apologised for it in so many words.
--
-- The other seven dated everything 2002, so their entries start there and are
-- left alone.

update public.country set euro_since = 1999
 where code in ('BE', 'ES', 'FI', 'FR', 'NL');

-- The generator started its series at 2002, so lowering euro_since alone would
-- have changed nothing. It now starts at the first year any country struck a
-- coin, and the existing guard keeps every other country where it was.
create or replace function public.extend_catalog(max_year int)
returns void
language sql
as $$
  insert into public.coin_type (country_code, face_value_cents, year)
  select c.code, v.value, y.year
  from public.country c
  cross join (values (1),(2),(5),(10),(20),(50),(100),(200)) as v(value)
  cross join generate_series(1999, max_year) as y(year)
  where y.year >= c.euro_since
  on conflict (country_code, face_value_cents, year, variant) do nothing;
$$;

-- Same pinned year as the original seed, for the same reason: deriving it from
-- now() would make the migration produce a different catalog depending on when
-- it is replayed.
select public.extend_catalog(2026);
