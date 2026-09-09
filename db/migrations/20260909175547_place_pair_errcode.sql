-- place_pair says "not found" in a code, like everything around it.
--
-- Its two raises carried no errcode, so they arrived as P0001 -- the catch-all
-- every bare `raise exception` in plpgsql produces. A server cannot act on that
-- without matching the message text, which is a string we wrote and could
-- reword, and which is the wrong thing to build behaviour on.
--
-- The neighbouring triggers already settled the convention: coin_fits_page
-- raises 23503 for a page that is not there, 23514 for a slot outside it. This
-- says the same thing about a coin, in the same vocabulary.
--
-- Only the two `using` clauses differ from the original; the body is otherwise
-- unchanged and repeated in full because CREATE OR REPLACE takes no patch.

-- migrate:up

create or replace function public.place_pair(
  first_coin    uuid,
  first_page    uuid,
  first_row     smallint,
  first_column  smallint,
  second_coin   uuid,
  second_page   uuid,
  second_row    smallint,
  second_column smallint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  low     uuid := least(first_coin, second_coin);
  high    uuid := greatest(first_coin, second_coin);
  touched int;
begin
  set constraints public.coins_slot_key deferred;

  perform 1 from public.coins where coin_id = low  for update;
  perform 1 from public.coins where coin_id = high for update;

  update public.coins
     set page_id = first_page, slot_row = first_row, slot_column = first_column
   where coin_id = first_coin;
  get diagnostics touched = row_count;
  if touched = 0 then
    raise exception 'coin not found: %', first_coin using errcode = '23503';
  end if;

  update public.coins
     set page_id = second_page, slot_row = second_row, slot_column = second_column
   where coin_id = second_coin;
  get diagnostics touched = row_count;
  if touched = 0 then
    raise exception 'coin not found: %', second_coin using errcode = '23503';
  end if;
end;
$$;

-- migrate:down

create or replace function public.place_pair(
  first_coin    uuid,
  first_page    uuid,
  first_row     smallint,
  first_column  smallint,
  second_coin   uuid,
  second_page   uuid,
  second_row    smallint,
  second_column smallint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  low     uuid := least(first_coin, second_coin);
  high    uuid := greatest(first_coin, second_coin);
  touched int;
begin
  set constraints public.coins_slot_key deferred;

  perform 1 from public.coins where coin_id = low  for update;
  perform 1 from public.coins where coin_id = high for update;

  update public.coins
     set page_id = first_page, slot_row = first_row, slot_column = first_column
   where coin_id = first_coin;
  get diagnostics touched = row_count;
  if touched = 0 then
    raise exception 'coin not found: %', first_coin;
  end if;

  update public.coins
     set page_id = second_page, slot_row = second_row, slot_column = second_column
   where coin_id = second_coin;
  get diagnostics touched = row_count;
  if touched = 0 then
    raise exception 'coin not found: %', second_coin;
  end if;
end;
$$;
