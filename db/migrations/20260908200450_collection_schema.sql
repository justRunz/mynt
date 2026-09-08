-- The collection itself.
--
-- Two halves that do not resemble each other. The catalog is shared, fixed and
-- readable by everyone; the coins are private and editable. That split is what
-- the row level security policies rest on.
--
-- Tables are plural, keys are singular and carry their table's name:
-- coins.coin_id, pages.page_id. Foreign keys already followed that convention,
-- only the primary keys were bare.

-- migrate:up

-- Grading scales are national and are not translations of one another
-- (fr: B/TB/TTB/SUP/SPL/FDC, en: G/VG/F/VF/XF/AU/UNC, de: S/SS/VZ/ST).
-- Codes are stored in English, the French label comes from i18n.
--
-- An enum rather than a constrained text column: it sorts by declaration order,
-- worst to best, which text would not. The cost is that inserting a value in
-- the middle later means rebuilding the type -- deliberate, since these four
-- cover circulating euros.
create type coin_grade as enum (
  'VERY_FINE',           -- fr: TB
  'EXTREMELY_FINE',      -- fr: TTB
  'ABOUT_UNCIRCULATED',  -- fr: SUP
  'UNCIRCULATED'         -- fr: FDC
);

-- ---------------------------------------------------------------------------
-- Shared catalog
-- ---------------------------------------------------------------------------

-- No country name column: it would be redundant and lock the app to one
-- language. The front end derives it from the ISO code via Intl.DisplayNames.
--
-- text with a constraint rather than char(2): char pads with spaces and ignores
-- them when comparing, an inherited behaviour that surprises. The constraint
-- says the rule out loud instead.
create table countries (
  country_code  text primary key check (country_code ~ '^[A-Z]{2}$'),
  euro_since    smallint not null,  -- year of that country's first minting
  -- Monaco, San Marino and the Vatican strike collector-only runs. Without this
  -- flag the completeness grid shows a permanent wall of cells nobody can fill.
  circulating   boolean not null default true
);

-- A catalog entry, not a coin: "the French 2 € of 2003" exists once, for
-- everyone. Three physical copies of it are three rows in coins pointing here.
--
-- This is what lets the app say what is *missing*: an absence cannot be derived
-- from what someone owns.
create table coin_types (
  coin_type_id      integer primary key generated always as identity,
  country_code      text not null references countries(country_code),
  face_value_cents  smallint not null,
  year              smallint not null,
  -- Empty in v1, but part of the unique key from day one: adding a column to a
  -- unique constraint later means rebuilding the index on a populated table.
  --
  -- Defaults to '' rather than null, and not for the reason usually given.
  -- Postgres 15 added `unique nulls not distinct`, so the constraint could cope
  -- with nulls now. The real reason is that this value crosses into JavaScript
  -- and is concatenated into a lookup key: a null would land there as the word
  -- "null" and split one coin type into two keys.
  --
  -- When it fills up (German mint marks, the 2007 common reverse, Belgian
  -- effigies) it must hold codes plus i18n keys, never free text.
  variant           text not null default '',
  unique (country_code, face_value_cents, year, variant),
  constraint known_face_value
    check (face_value_cents in (1, 2, 5, 10, 20, 50, 100, 200))
);

-- ---------------------------------------------------------------------------
-- Private data
-- ---------------------------------------------------------------------------

-- uuidv7 rather than the random v4 of gen_random_uuid(): a v7 sorts by time, so
-- inserts land at the right edge of the index instead of scattering across it.
-- Postgres 18 provides it, which is why the container runs that version.

create table binders (
  binder_id  uuid primary key default uuidv7(),
  user_id    uuid not null references user_info(user_id) on delete cascade,
  name       text not null
);

-- No user_id here: a page belongs to a binder which belongs to someone, so
-- ownership is already reachable by join. Duplicating it would create a second
-- copy that can drift from the first.
create table pages (
  page_id       uuid primary key default uuidv7(),
  binder_id     uuid not null references binders(binder_id) on delete cascade,
  page_number   smallint not null,
  -- Album sheets come in many formats depending on coin diameter, so the grid
  -- size is asked for rather than fixed.
  row_count     smallint not null check (row_count > 0),
  column_count  smallint not null check (column_count > 0),
  unique (binder_id, page_number)
);

create table coins (
  coin_id       uuid primary key default uuidv7(),
  user_id       uuid not null references user_info(user_id) on delete cascade,
  coin_type_id  integer not null references coin_types(coin_type_id),
  grade         coin_grade,
  acquired_on   date,
  notes         text,
  -- Position is nullable: a coin in a jar waiting to be filed is a normal
  -- state, not an anomaly. And deleting a page sends its coins back to the jar
  -- rather than destroying them -- the one place in this schema where deletion
  -- deliberately stops instead of cascading.
  page_id       uuid references pages(page_id) on delete set null,
  slot_row      smallint,
  slot_column   smallint,

  -- Two coins cannot share a hole. Deferrable from the start so place_pair can
  -- suspend it for the length of its own transaction, when two coins briefly
  -- claim the same hole while exchanging places. INITIALLY IMMEDIATE on
  -- purpose: every other write still fails on the offending statement rather
  -- than at commit, so an ordinary filing conflict surfaces where it happens.
  --
  -- Named rather than left to Postgres, so place_pair can refer to it without
  -- depending on a generated name.
  constraint coins_slot_key
    unique (page_id, slot_row, slot_column) deferrable initially immediate,

  -- Unfiled coins all carry a null page_id, and null is never equal to null, so
  -- the constraint above never compares them to each other. A hundred coins in
  -- the jar, no conflict. Same rule as the variant column above, opposite
  -- effect, both wanted.

  -- Either fully filed or not filed at all.
  constraint position_all_or_nothing check (
    (page_id is null and slot_row is null and slot_column is null)
    or (page_id is not null and slot_row is not null and slot_column is not null)
  ),
  -- Counted from 1, like the holes on a sheet.
  constraint position_is_positive check (
    (slot_row is null or slot_row > 0)
    and (slot_column is null or slot_column > 0)
  )
);

-- slot_row <= pages.row_count cannot be a CHECK across tables; a trigger
-- enforces it, in its own migration.

create index on coins (user_id);
create index on binders (user_id);
create index on pages (binder_id);
create index on coins (coin_type_id);  -- completeness grid outer join

-- No index on coins (page_id): coins_slot_key already leads with that column,
-- and a query filtering on page_id alone uses its leftmost prefix.

-- migrate:down

drop table coins;
drop table pages;
drop table binders;
drop table coin_types;
drop table countries;
drop type coin_grade;
