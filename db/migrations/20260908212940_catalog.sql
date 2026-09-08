-- The shared catalog: what exists, as opposed to what anyone owns.
--
-- It has no external source. Numista and Colnect hold this data, but depending
-- on them would mean an API key, a quota, a service that can close -- and an
-- app that stops working in a flea market with no signal. A euro catalog is
-- finite and small, so it is computed instead.
--
-- The entire hand-written input is the twenty-four rows below: a country code,
-- the year of its first minting, and whether its coins circulate. The eight
-- face values are not data either -- they are fixed by the currency. Everything
-- after that is arithmetic.

-- migrate:up

insert into countries (country_code, euro_since, circulating) values
  -- Five of the twelve founding countries dated their first coins with the year
  -- they were struck rather than 2002: Belgium, Spain, Finland, France and the
  -- Netherlands all have pieces reading 1999, 2000 or 2001. They circulated
  -- from day one and sit in collections today.
  ('BE',1999,true), ('ES',1999,true), ('FI',1999,true), ('FR',1999,true),
  ('NL',1999,true),
  -- The other seven dated everything 2002.
  ('DE',2002,true), ('IE',2002,true), ('IT',2002,true), ('LU',2002,true),
  ('AT',2002,true), ('PT',2002,true), ('GR',2002,true),
  -- Later arrivals.
  ('SI',2007,true), ('CY',2008,true), ('MT',2008,true), ('SK',2009,true),
  ('EE',2011,true), ('LV',2014,true), ('LT',2015,true), ('HR',2023,true),
  -- Collector-only mintages, hidden from the completeness grid by default:
  -- without the flag their rows would be a permanent wall of cells nobody can
  -- fill.
  ('MC',2002,false), ('SM',2002,false), ('VA',2002,false),
  -- Andorra's coins do circulate, with mintages in the millions.
  ('AD',2014,true);

-- Fills in missing coin types up to the given year, and does nothing for those
-- already there.
--
-- Idempotent by construction, which is what lets it run on every deployment
-- rather than in a migration. Two copies running at once cannot collide either
-- -- the ON CONFLICT settles it -- so no lock is needed.
create function public.extend_catalog(max_year int)
returns void
language sql
as $$
  insert into public.coin_types (country_code, face_value_cents, year)
  select c.country_code, v.value, y.year
  from public.countries c
  cross join (values (1),(2),(5),(10),(20),(50),(100),(200)) as v(value)
  -- From the first year any country struck a coin, with the guard below keeping
  -- every other country at its own starting point.
  cross join generate_series(1999, max_year) as y(year)
  where y.year >= c.euro_since
  on conflict (country_code, face_value_cents, year, variant) do nothing;
$$;

-- Only the owner runs this. It is not part of what the application may do:
-- writing to the catalog is a deployment step, never a request.
revoke execute on function public.extend_catalog(int) from public;

-- Deliberately not called here.
--
-- A migration must produce the same result whenever it is replayed, so it
-- cannot derive a year from now(). But the catalog growing by one year is not
-- a schema change at all -- it is upkeep, idempotent and safe to repeat. It
-- belongs to `pnpm db:catalog`, which runs on every deployment with the current
-- year, so nothing has to be remembered each January.

-- migrate:down

drop function public.extend_catalog(int);
delete from countries;
