-- Mynt base schema.
--
-- The core distinction is between coin_type (shared catalog entry) and coin
-- (a physical piece owned by one user). Duplicates are routine in this hobby,
-- so a single coin_type may back many coin rows.

-- Grade scales are national and not translations of one another
-- (fr: B/TB/TTB/SUP/SPL/FDC, en: G/VG/F/VF/XF/AU/UNC, de: S/SS/VZ/ST).
-- Codes are stored in English, the French label comes from i18n.
-- An enum rather than a constrained text column: it sorts by declaration
-- order, worst to best, which text would not.
create type coin_grade as enum (
  'VERY_FINE',           -- fr: TB
  'EXTREMELY_FINE',      -- fr: TTB
  'ABOUT_UNCIRCULATED',  -- fr: SUP
  'UNCIRCULATED'         -- fr: FDC
);

-- The only table tied to authentication. Everything else points here,
-- never at auth.users, so swapping auth systems means relinking one table.
create table profile (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shared catalog
-- ---------------------------------------------------------------------------

-- No country name column: it would be redundant and lock the app to one
-- language. The front end derives it from the ISO code via Intl.DisplayNames.
create table country (
  code         char(2) primary key,
  euro_since   smallint not null,  -- year the country joined the eurozone
  -- Monaco, San Marino and the Vatican mint collector-only runs. Without this
  -- flag the completeness grid shows a permanent wall of empty cells.
  circulating  boolean not null default true
);

create table coin_type (
  id                serial primary key,
  country_code      char(2) not null references country(code),
  face_value_cents  smallint not null,
  year              smallint not null,
  -- Empty in v1, but part of the unique key from day one: adding a column to a
  -- unique constraint later means rebuilding the index on a populated table.
  -- Defaults to '' rather than null because null never equals null, which
  -- would let duplicates through the constraint.
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

-- UUIDs rather than serials on the private tables: offline creation needs an
-- id before the row ever reaches the server, and a page created offline must
-- be referenceable by the coins filed into it without an id remapping layer.
-- The client supplies a uuidv7; the default is only a fallback.

create table binder (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profile(id) on delete cascade,
  name        text not null,
  sort_order  smallint not null default 0
);

-- No profile_id here: a page belongs to a binder which belongs to a profile,
-- so ownership is already reachable by join. Duplicating it would create
-- redundancy that can drift.
create table page (
  id            uuid primary key default gen_random_uuid(),
  binder_id     uuid not null references binder(id) on delete cascade,
  number        smallint not null,
  -- Album sheets come in many formats depending on coin diameter, so the grid
  -- size is configurable per page rather than fixed.
  row_count     smallint not null check (row_count > 0),
  column_count  smallint not null check (column_count > 0),
  unique (binder_id, number)
);

create table coin (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profile(id) on delete cascade,
  coin_type_id  int not null references coin_type(id),
  grade         coin_grade,
  acquired_on   date,
  notes         text,
  -- Position is nullable: a coin sitting in a jar waiting to be filed is a
  -- normal state, not an anomaly.
  page_id       uuid references page(id) on delete set null,
  slot_row      smallint,
  slot_column   smallint,
  -- Two coins cannot share a slot. No need to include the profile: the page
  -- already belongs to exactly one owner.
  unique (page_id, slot_row, slot_column),
  -- Either fully filed or not filed at all.
  constraint position_all_or_nothing check (
    (page_id is null and slot_row is null and slot_column is null)
    or (page_id is not null and slot_row is not null and slot_column is not null)
  ),
  constraint position_is_positive check (
    (slot_row is null or slot_row > 0)
    and (slot_column is null or slot_column > 0)
  )
);

-- slot_row <= page.row_count cannot be a CHECK across tables; it is enforced
-- in the app when filing a coin.

create index on coin (profile_id);
create index on binder (profile_id);
create index on page (binder_id);
create index on coin (coin_type_id);  -- completeness grid outer join
create index on coin (page_id);       -- binder view
