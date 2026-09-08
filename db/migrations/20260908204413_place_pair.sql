-- Moving two coins at once, which is what dropping one onto an occupied hole
-- has to do.
--
-- It cannot be two ordinary updates: the first lands on a hole the second coin
-- has not left yet, and coins_slot_key rejects it. Nor can it be three writes
-- -- park one in the jar, move the other, bring the first back -- because an
-- interruption between any two of them leaves a coin sitting in the jar with
-- nobody the wiser. One function, one transaction, one exchange.

-- migrate:up

-- Security invoker, which is the default and is spelled out here because it is
-- load-bearing: the function must be subject to the same row level security as
-- a direct update, or it would become a way to move another collector's coins
-- by passing their ids.
--
-- search_path is pinned to nothing so every name has to be qualified. A
-- function that resolves names through a caller-controlled search path can be
-- pointed at a different table than the one it was written for.
create function public.place_pair(
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
  -- Suspended until commit, so the moment where both coins claim the same hole
  -- is legal. Scoped to this transaction only: every other write still fails on
  -- the offending statement, so an ordinary filing conflict keeps surfacing
  -- where it happens rather than at the end.
  set constraints public.coins_slot_key deferred;

  -- Locked in a stable order, so two exchanges sharing a coin cannot deadlock
  -- by each holding what the other is waiting for.
  perform 1 from public.coins where coin_id = low  for update;
  perform 1 from public.coins where coin_id = high for update;

  update public.coins
     set page_id = first_page, slot_row = first_row, slot_column = first_column
   where coin_id = first_coin;
  get diagnostics touched = row_count;
  -- Zero rows means the coin does not exist, or that row level security hides
  -- it -- someone else's. Moving only one of the pair would leave the page
  -- inconsistent, so neither moves.
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

-- The costume calls it; nobody else needs to.
grant execute on function public.place_pair to authenticated;

-- migrate:down

drop function public.place_pair;
