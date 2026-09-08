-- A coin cannot be filed outside the sheet it sits on.
--
-- Postgres cannot express this as a CHECK: the limit lives in another table,
-- and a CHECK may only read the row it constrains. Until now the rule was left
-- to the application, which repaired the damage afterwards -- the binder view
-- still says "N coin(s) filed outside this page's dimensions".
--
-- Two triggers, because the rule can be broken from either side: by sending a
-- coin past the edge, or by shrinking the sheet under coins already there.

-- migrate:up

-- Security invoker, and that is what closes a second hole.
--
-- The foreign key on coins.page_id is checked with elevated privileges, as all
-- referential integrity is, so it happily accepts a page belonging to somebody
-- else -- the policy on coins only checks who owns the *coin*. Nothing stopped
-- a collector from filing coins into another's binder: invisible to the owner,
-- yet occupying holes they could no longer use.
--
-- Reading pages from inside an invoker function goes through row level
-- security, so another collector's page is simply not there, and the lookup
-- below finds nothing.
create function public.coin_fits_page() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rows_available    smallint;
  columns_available smallint;
begin
  -- A coin in the jar has no sheet to fall off.
  if new.page_id is null then
    return new;
  end if;

  select p.row_count, p.column_count
    into rows_available, columns_available
    from public.pages p
   where p.page_id = new.page_id;

  -- Not found means the page does not exist, or belongs to someone else and is
  -- therefore invisible here. Both are refusals, and telling them apart would
  -- reveal that another collector holds that page.
  if rows_available is null then
    raise exception 'page not found: %', new.page_id
      using errcode = '23503';
  end if;

  if new.slot_row > rows_available or new.slot_column > columns_available then
    raise exception 'slot %x% is outside a %x% page',
      new.slot_row, new.slot_column, rows_available, columns_available
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger coin_fits_page
  before insert or update of page_id, slot_row, slot_column on public.coins
  for each row execute function public.coin_fits_page();

-- The other direction: a sheet cannot shrink out from under its coins.
--
-- Refusing is kinder than allowing it and repairing later. "Move these three
-- coins first" is a sentence someone can act on; discovering afterwards that
-- coins have quietly fallen off the edge is not.
create function public.page_fits_coins() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Growing, or unchanged, can displace nothing.
  if new.row_count >= old.row_count and new.column_count >= old.column_count then
    return new;
  end if;

  if exists (
    select 1 from public.coins c
     where c.page_id = new.page_id
       and (c.slot_row > new.row_count or c.slot_column > new.column_count)
  ) then
    raise exception 'page cannot shrink to %x%: coins are filed outside it',
      new.row_count, new.column_count
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger page_fits_coins
  before update of row_count, column_count on public.pages
  for each row execute function public.page_fits_coins();

-- migrate:down

drop trigger page_fits_coins on public.pages;
drop function public.page_fits_coins;
drop trigger coin_fits_page on public.coins;
drop function public.coin_fits_page;
