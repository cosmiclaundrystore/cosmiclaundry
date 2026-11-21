-- Orders, order lines, PAYable payment attempts and shipping rates for guest checkout.
-- Orders are private: no API policies. Only the server (secret key) reads and writes them,
-- and the multi-step writes go through the security-definer functions below so each one is atomic.

-- Flat delivery fee per region, in minor units of the region's currency.
create table public.shipping_rates (
  region_code text primary key references public.regions (code) on update cascade on delete cascade,
  amount_minor integer not null check (amount_minor >= 0),
  label text not null default 'Delivery',
  updated_at timestamptz not null default now()
);
create trigger shipping_rates_set_updated_at before update on public.shipping_rates
  for each row execute function public.set_updated_at();

-- PLACEHOLDER: LKR 400.00 island-wide delivery. Change this to the real fee before launch.
insert into public.shipping_rates (region_code, amount_minor, label) values ('LK', 40000, 'Island-wide delivery');

alter table public.shipping_rates enable row level security;
create policy "Anyone can read shipping rates" on public.shipping_rates
  for select to anon, authenticated using (true);
revoke all on public.shipping_rates from anon, authenticated;
grant select on public.shipping_rates to anon, authenticated;

-- Customer-facing order numbers: CL-1001, CL-1002, ...
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('CL-' || nextval('public.order_number_seq')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled', 'fulfilled', 'refunded')),
  region_code text not null references public.regions (code) on update cascade on delete restrict,
  currency char(3) not null check (currency in ('LKR', 'GBP', 'USD')),
  subtotal_minor integer not null check (subtotal_minor >= 0),
  shipping_minor integer not null check (shipping_minor >= 0),
  total_minor integer not null check (total_minor > 0 and total_minor = subtotal_minor + shipping_minor),
  email text not null,
  phone text not null,
  first_name text not null,
  last_name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  postcode text not null,
  country_code char(2) not null,
  notes text,
  -- SHA-256 (hex) of the secret in the customer's order link. The secret itself is never stored.
  access_token_hash text not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_created_at_idx on public.orders (status, created_at desc);
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Lines keep a copy of the name and price at the time of the order.
create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text references public.products (id) on update cascade on delete set null,
  product_name text not null,
  color text not null,
  size text not null,
  quantity integer not null check (quantity between 1 and 99),
  unit_price_minor integer not null check (unit_price_minor > 0),
  line_total_minor integer not null check (line_total_minor = unit_price_minor * quantity)
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

-- One row per trip to PAYable. invoice_id (CL-1001-1, CL-1001-2, ...) is what PAYable sees.
create table public.payment_attempts (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  attempt integer not null check (attempt between 1 and 20),
  invoice_id text not null unique,
  amount_minor integer not null check (amount_minor > 0),
  currency char(3) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  payable_order_id text,
  payable_transaction_id text,
  payment_method text,
  card_number_masked text,
  status_code text,
  webhook_payload jsonb,
  webhook_received_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, attempt)
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_attempts enable row level security;
revoke all on public.orders, public.order_items, public.payment_attempts from anon, authenticated;
revoke all on sequence public.order_number_seq from anon, authenticated;

-- Creates a pending order and its lines in one transaction. Prices are computed by the server beforehand.
create or replace function public.create_order(p jsonb)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  insert into public.orders (
    region_code, currency, subtotal_minor, shipping_minor, total_minor,
    email, phone, first_name, last_name, address_line1, address_line2, city, postcode, country_code, notes,
    access_token_hash
  ) values (
    p->>'region_code', p->>'currency', (p->>'subtotal_minor')::integer, (p->>'shipping_minor')::integer,
    (p->>'total_minor')::integer,
    p->>'email', p->>'phone', p->>'first_name', p->>'last_name', p->>'address_line1', nullif(p->>'address_line2', ''),
    p->>'city', p->>'postcode', p->>'country_code', nullif(p->>'notes', ''),
    p->>'access_token_hash'
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, color, size, quantity, unit_price_minor, line_total_minor)
  select v_order.id, i->>'product_id', i->>'product_name', i->>'color', i->>'size', (i->>'quantity')::integer,
         (i->>'unit_price_minor')::integer, (i->>'line_total_minor')::integer
  from jsonb_array_elements(p->'items') as i;

  if not found then
    raise exception 'An order needs at least one item';
  end if;

  return query select v_order.id, v_order.number;
end;
$$;

-- Opens the next payment attempt for an unpaid order and returns what to send to PAYable.
create or replace function public.start_payment_attempt(p_order_number text)
returns table (invoice_id text, attempt integer, amount_minor integer, currency text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_attempt integer;
begin
  select * into v_order from public.orders o where o.number = p_order_number for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status not in ('pending', 'failed') then
    raise exception 'order_not_payable';
  end if;

  select coalesce(max(a.attempt), 0) + 1 into v_attempt from public.payment_attempts a where a.order_id = v_order.id;
  if v_attempt > 20 then
    raise exception 'too_many_attempts';
  end if;

  insert into public.payment_attempts (order_id, attempt, invoice_id, amount_minor, currency)
  values (v_order.id, v_attempt, v_order.number || '-' || v_attempt, v_order.total_minor, v_order.currency);

  update public.orders set status = 'pending' where id = v_order.id and status = 'failed';

  return query select v_order.number || '-' || v_attempt, v_attempt, v_order.total_minor, v_order.currency::text;
end;
$$;

-- Applies a verified PAYable webhook. Safe to call more than once for the same attempt.
-- Returns: 'applied', 'duplicate' (attempt already settled), 'paid_again' (a second attempt was paid
-- for an order that was already paid: refund it), or 'unknown_invoice'.
create or replace function public.record_payment_result(
  p_invoice_id text,
  p_success boolean,
  p_payload jsonb,
  p_payable_order_id text,
  p_payable_transaction_id text,
  p_payment_method text,
  p_card_number_masked text,
  p_status_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts;
  v_order public.orders;
begin
  select * into v_attempt from public.payment_attempts a where a.invoice_id = p_invoice_id for update;
  if not found then
    return 'unknown_invoice';
  end if;
  if v_attempt.status <> 'pending' then
    return 'duplicate';
  end if;

  select * into v_order from public.orders o where o.id = v_attempt.order_id for update;

  update public.payment_attempts set
    status = case when p_success then 'paid' else 'failed' end,
    payable_order_id = p_payable_order_id,
    payable_transaction_id = p_payable_transaction_id,
    payment_method = p_payment_method,
    card_number_masked = p_card_number_masked,
    status_code = p_status_code,
    webhook_payload = p_payload,
    webhook_received_at = now()
  where id = v_attempt.id;

  if p_success then
    if v_order.status = 'paid' then
      return 'paid_again';
    end if;
    update public.orders set status = 'paid', paid_at = now() where id = v_order.id;
  elsif v_order.status = 'pending' then
    -- Only mark the order failed if no other attempt for it is still open.
    if not exists (
      select 1 from public.payment_attempts a where a.order_id = v_order.id and a.status = 'pending'
    ) then
      update public.orders set status = 'failed' where id = v_order.id;
    end if;
  end if;

  return 'applied';
end;
$$;

revoke execute on function public.create_order(jsonb) from public, anon, authenticated;
revoke execute on function public.start_payment_attempt(text) from public, anon, authenticated;
revoke execute on function public.record_payment_result(text, boolean, jsonb, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;
grant execute on function public.start_payment_attempt(text) to service_role;
grant execute on function public.record_payment_result(text, boolean, jsonb, text, text, text, text, text) to service_role;
