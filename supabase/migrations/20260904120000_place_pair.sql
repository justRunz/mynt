-- Moving two coins at once, which is what dragging one onto an occupied hole
-- has to do.
--
-- It cannot be two ordinary updates: the first lands on a hole the second coin
-- has not left yet, and the unique constraint rejects it. Nor can it be three
-- writes -- park one in the jar, move the other, bring the first back -- because
-- a queue interrupted between any two of them leaves a coin sitting in the jar
-- with nobody the wiser. One function, one transaction, one entry in the
-- offline queue.
--
-- The arguments are absolute destinations rather than "swap these two" on
-- purpose. Every write in this app has to survive being replayed after a
-- reconnect, and a swap is the one shape that does not: running it twice puts
-- both coins back where they started. Assigning positions is idempotent.

-- Deferrable so the intermediate state, where both coins briefly claim the same
-- hole, is legal until commit. Left INITIALLY IMMEDIATE on purpose: every other
-- write should still fail on the offending statement rather than at commit, so
-- an ordinary filing conflict keeps surfacing where it happens. Only the
-- function below defers it, and only for its own transaction.
alter table public.coin
  drop constraint coin_page_id_slot_row_slot_column_key;

alter table public.coin
  add constraint coin_page_id_slot_row_slot_column_key
  unique (page_id, slot_row, slot_column) deferrable initially immediate;

-- Security invoker (the default), not definer: the function must be subject to
-- the same row level security as a direct update, or it would become a way to
-- move another collector's coins by passing their ids.
create or replace function public.place_pair(
  first_coin uuid,
  first_page uuid,
  first_row smallint,
  first_column smallint,
  second_coin uuid,
  second_page uuid,
  second_row smallint,
  second_column smallint
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  low uuid := least(first_coin, second_coin);
  high uuid := greatest(first_coin, second_coin);
  touched int;
begin
  set constraints public.coin_page_id_slot_row_slot_column_key deferred;

  -- Locked in a stable order so two moves sharing a coin cannot deadlock.
  perform 1 from public.coin where id = low for update;
  perform 1 from public.coin where id = high for update;

  update public.coin
     set page_id = first_page, slot_row = first_row, slot_column = first_column
   where id = first_coin;
  get diagnostics touched = row_count;
  -- Zero rows means the coin does not exist or row level security hides it.
  -- Silently moving only one of the pair would leave the page inconsistent.
  if touched = 0 then
    raise exception 'coin not found: %', first_coin;
  end if;

  update public.coin
     set page_id = second_page, slot_row = second_row, slot_column = second_column
   where id = second_coin;
  get diagnostics touched = row_count;
  if touched = 0 then
    raise exception 'coin not found: %', second_coin;
  end if;
end;
$$;
