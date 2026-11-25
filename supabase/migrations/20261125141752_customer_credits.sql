-- Customer accounts and credits.
-- - Customers sign in with Supabase Auth (password, Google or Apple). Orders placed while signed in are linked to them.
-- - When a linked order is delivered it earns credits: 100 per tee, 200 per Custom tee (made to order).
-- - Every 1,000 credits unlock a reward: 20% off the tees plus free delivery on one order. Credits and rewards don't expire.
-- - A reward is held when an order is placed with it, used when that order is paid, and returned if the order is cancelled
--   or refunded. A refund also takes back the credits the order earned.
-- Everything here is private (row level security, no public policies): the server reads and writes with the secret key
-- after checking who is signed in.

-- ---------- Accounts ----------
create table public.customer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customer_profiles_set_updated_at before update on public.customer_profiles
  for each row execute function public.set_updated_at();

alter table public.orders
  add column user_id uuid references auth.users (id) on delete set null,
  add column discount_minor integer not null default 0 check (discount_minor >= 0),
  add column reward_id uuid;
create index orders_user_id_idx on public.orders (user_id, created_at desc);

-- The total now allows for a reward discount.
alter table public.orders drop constraint if exists orders_check;
alter table public.orders drop constraint if exists orders_total_minor_check;
alter table public.orders add constraint orders_total_minor_check
  check (total_minor > 0 and total_minor = subtotal_minor + shipping_minor - discount_minor);

-- ---------- Credits and rewards ----------
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  delta integer not null,
  reason text not null check (reason in ('order_delivered', 'order_refunded', 'reward_unlocked', 'adjustment')),
  note text,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);
-- An order earns (and loses) its credits at most once.
create unique index credit_ledger_order_reason_key on public.credit_ledger (order_id, reason)
  where order_id is not null and reason in ('order_delivered', 'order_refunded');

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'available' check (status in ('available', 'held', 'used')),
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index rewards_user_idx on public.rewards (user_id, status);
alter table public.orders add constraint orders_reward_id_fkey foreign key (reward_id) references public.rewards (id) on delete set null;

alter table public.customer_profiles enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.rewards enable row level security;
revoke all on public.customer_profiles, public.credit_ledger, public.rewards from anon, authenticated;
grant select, insert, update on public.customer_profiles to service_role;
grant select, insert on public.credit_ledger to service_role;
grant select, insert, update on public.rewards to service_role;

-- ---------- Rules ----------
-- Credits an order is worth: 100 per tee, 200 per Custom tee.
create or replace function public.order_credit_value(p_order_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(i.quantity * case when i.design_path is not null or p.collection_id = 'custom' then 200 else 100 end), 0)::integer
  from public.order_items i
  left join public.products p on p.id = i.product_id
  where i.order_id = p_order_id;
$$;

-- Turns every full 1,000 credits into a reward.
create or replace function public.unlock_rewards(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  perform pg_advisory_xact_lock(hashtext('credits:' || p_user_id::text));
  select coalesce(sum(delta), 0) into v_balance from public.credit_ledger where user_id = p_user_id;
  while v_balance >= 1000 loop
    insert into public.rewards (user_id) values (p_user_id);
    insert into public.credit_ledger (user_id, delta, reason, note) values (p_user_id, -1000, 'reward_unlocked', '20% off + free delivery');
    v_balance := v_balance - 1000;
  end loop;
end;
$$;

-- Gives a delivered, linked, paid order its credits (once).
create or replace function public.grant_order_credits(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_value integer;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.user_id is null or v_order.fulfillment_status <> 'delivered'
     or v_order.status not in ('paid', 'fulfilled') then
    return;
  end if;
  v_value := public.order_credit_value(p_order_id);
  if v_value <= 0 then return; end if;
  insert into public.credit_ledger (user_id, order_id, delta, reason, note)
  values (v_order.user_id, p_order_id, v_value, 'order_delivered', v_order.number)
  on conflict do nothing;
  perform public.unlock_rewards(v_order.user_id);
end;
$$;

-- Reacts to order changes: payment, cancellation, refund and delivery.
create or replace function public.orders_credit_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_earned integer;
begin
  -- Paid with a reward: the reward is used up.
  if new.reward_id is not null and new.status in ('paid', 'fulfilled') and old.status is distinct from new.status then
    update public.rewards set status = 'used', used_at = now(), order_id = new.id
    where id = new.reward_id and status <> 'used';
  end if;
  -- Cancelled or refunded: the reward comes back.
  if new.reward_id is not null and new.status in ('cancelled', 'refunded') and old.status is distinct from new.status then
    update public.rewards set status = 'available', used_at = null, order_id = null where id = new.reward_id;
  end if;
  -- Refunded after its credits were given: they are taken back.
  if new.status = 'refunded' and old.status is distinct from 'refunded' and new.user_id is not null then
    select delta into v_earned from public.credit_ledger where order_id = new.id and reason = 'order_delivered';
    if v_earned is not null then
      insert into public.credit_ledger (user_id, order_id, delta, reason, note)
      values (new.user_id, new.id, -v_earned, 'order_refunded', new.number)
      on conflict do nothing;
    end if;
  end if;
  -- Delivered: credits are earned.
  if new.fulfillment_status = 'delivered' and old.fulfillment_status is distinct from 'delivered' then
    perform public.grant_order_credits(new.id);
  end if;
  return new;
end;
$$;

create trigger orders_credit_rules
  after update of status, fulfillment_status on public.orders
  for each row execute function public.orders_credit_rules();

-- Links earlier guest orders placed with the customer's (verified) email, and credits the delivered ones.
-- Returns how many orders were linked.
create or replace function public.link_guest_orders(p_user_id uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id uuid;
begin
  with linked as (
    update public.orders set user_id = p_user_id
    where user_id is null and lower(email) = lower(p_email)
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from linked;
  foreach v_id in array v_ids loop
    perform public.grant_order_credits(v_id);
  end loop;
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

-- ---------- Orders: same as before, plus the account, discount and reward ----------
create or replace function public.create_order(p jsonb)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_user uuid := nullif(p->>'user_id', '')::uuid;
  v_reward uuid := nullif(p->>'reward_id', '')::uuid;
begin
  -- A reward can only be used by its owner, once, and not by two orders at the same time.
  if v_reward is not null then
    update public.rewards set status = 'held'
    where id = v_reward and user_id = v_user and status = 'available';
    if not found then
      raise exception 'reward_unavailable';
    end if;
  end if;

  insert into public.orders (
    region_code, currency, subtotal_minor, shipping_minor, discount_minor, total_minor,
    email, phone, first_name, last_name, address_line1, address_line2, city, postcode, country_code, notes,
    access_token_hash, visitor_country, user_id, reward_id
  ) values (
    p->>'region_code', p->>'currency', (p->>'subtotal_minor')::integer, (p->>'shipping_minor')::integer,
    coalesce((p->>'discount_minor')::integer, 0), (p->>'total_minor')::integer,
    p->>'email', p->>'phone', p->>'first_name', p->>'last_name', p->>'address_line1', nullif(p->>'address_line2', ''),
    p->>'city', p->>'postcode', p->>'country_code', nullif(p->>'notes', ''),
    p->>'access_token_hash', upper(nullif(p->>'visitor_country', '')), v_user, v_reward
  )
  returning * into v_order;

  if v_reward is not null then
    update public.rewards set order_id = v_order.id where id = v_reward;
  end if;

  insert into public.order_items (order_id, product_id, product_name, color, size, quantity, unit_price_minor, line_total_minor, design_path, design_note)
  select v_order.id, i->>'product_id', i->>'product_name', i->>'color', i->>'size', (i->>'quantity')::integer,
         (i->>'unit_price_minor')::integer, (i->>'line_total_minor')::integer,
         nullif(i->>'design_path', ''), nullif(i->>'design_note', '')
  from jsonb_array_elements(p->'items') as i;

  if not found then
    raise exception 'An order needs at least one item';
  end if;

  return query select v_order.id, v_order.number;
end;
$$;

-- Unpaid orders holding a reward for over 24 hours are cancelled, so the reward comes back (daily clean-up job).
create or replace function public.release_stale_rewards()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.orders set status = 'cancelled'
  where reward_id is not null and status in ('pending', 'failed') and created_at < now() - interval '24 hours';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.order_credit_value(uuid), public.unlock_rewards(uuid), public.grant_order_credits(uuid),
  public.orders_credit_rules(), public.link_guest_orders(uuid, text), public.create_order(jsonb), public.release_stale_rewards()
  from public, anon, authenticated;
grant execute on function public.link_guest_orders(uuid, text), public.create_order(jsonb), public.release_stale_rewards()
  to service_role;
