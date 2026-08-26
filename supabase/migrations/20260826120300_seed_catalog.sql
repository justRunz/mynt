-- The euro catalog is small and finite, so it is generated locally rather than
-- pulled from an external API. This lives in a migration and not in seed.sql
-- because `supabase db push` does not carry seed data: a hosted project would
-- otherwise end up with an empty catalog.

insert into country (code, euro_since, circulating) values
  ('BE',2002,true), ('DE',2002,true), ('ES',2002,true), ('FR',2002,true),
  ('IE',2002,true), ('IT',2002,true), ('LU',2002,true), ('NL',2002,true),
  ('AT',2002,true), ('PT',2002,true), ('FI',2002,true), ('GR',2002,true),
  ('SI',2007,true), ('CY',2008,true), ('MT',2008,true), ('SK',2009,true),
  ('EE',2011,true), ('LV',2014,true), ('LT',2015,true), ('HR',2023,true),
  -- Collector-only mintages, hidden from the completeness grid by default.
  ('MC',2002,false), ('SM',2002,false), ('VA',2002,false),
  -- Andorra's coins do circulate, with mintages in the millions.
  ('AD',2014,true);

-- Fills in missing coin types up to the given year. Idempotent, so the yearly
-- migration is a one-liner: select public.extend_catalog(2027);
create function public.extend_catalog(max_year int)
returns void
language sql
as $$
  insert into public.coin_type (country_code, face_value_cents, year)
  select c.code, v.value, y.year
  from public.country c
  cross join (values (1),(2),(5),(10),(20),(50),(100),(200)) as v(value)
  cross join generate_series(2002, max_year) as y(year)
  where y.year >= c.euro_since
  on conflict (country_code, face_value_cents, year, variant) do nothing;
$$;

revoke execute on function public.extend_catalog(int) from public;

-- Pinned year, deliberately. Deriving it from now() would make the same
-- migration produce a different catalog depending on when it is replayed,
-- so a fresh environment would silently diverge from production.
select public.extend_catalog(2026);
