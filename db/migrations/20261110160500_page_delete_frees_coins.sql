-- Deleting a page sends its coins back to the jar, as the schema always said.
--
-- It said so and did not do it. coins.page_id is ON DELETE SET NULL, which
-- nulls the one column the foreign key is made of and leaves slot_row and
-- slot_column where they were -- and a coin with a hole but no page is exactly
-- what position_all_or_nothing refuses. So a page holding a single filed coin
-- could not be deleted at all, and neither could its binder, whose cascade
-- reaches the page: both failed on a check constraint nobody could act on.
--
-- Nothing reached it only because no route deletes a page or a binder yet.
--
-- SET NULL cannot be told to take the other two columns along: its column list
-- may only name columns of the foreign key itself. So the coins are unfiled
-- whole, just before the page goes, and the foreign key then finds nothing left
-- to do.

-- migrate:up

-- Security invoker, like every other trigger here. Deleting the page directly,
-- the collector's own policies apply and the coins on it are theirs -- the
-- trigger in slot_bounds is what keeps anybody else's off it. Reached through a
-- binder's cascade it runs as the tables' owner, as all referential actions do.
create function public.page_delete_frees_coins() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.coins
     set page_id = null, slot_row = null, slot_column = null
   where page_id = old.page_id;
  return old;
end;
$$;

create trigger page_delete_frees_coins
  before delete on public.pages
  for each row execute function public.page_delete_frees_coins();

-- migrate:down

drop trigger page_delete_frees_coins on public.pages;
drop function public.page_delete_frees_coins;
