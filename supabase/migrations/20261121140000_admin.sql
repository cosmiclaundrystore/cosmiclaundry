-- Admin dashboard (/admin).
-- Admins sign in with Supabase Auth (email + password). Only emails in admin_users get in; the server checks
-- this on every admin page and action, then reads and writes with the secret key (service_role).
-- Nothing here is opened to the public API roles (anon, authenticated).

-- ---------- Who may use the admin ----------
create table public.admin_users (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

-- ---------- Orders: delivery progress, kept apart from the payment status ----------
alter table public.orders
  add column fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'packed', 'shipped', 'delivered')),
  add column tracking_number text,
  add column courier text,
  add column admin_note text,
  add column shipped_at timestamptz;
create index orders_created_at_idx on public.orders (created_at desc);

-- ---------- Products: photos uploaded from the admin live in Storage ----------
-- Null = the photos ship with the site (public/assets/products/<id>-<colour>.webp).
-- Otherwise the public URL prefix in the product-images bucket, e.g. .../product-images/<id>/v1712345
alter table public.products add column image_base text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- ---------- Stock goes down when an order is paid ----------
-- Only variants with a stock number are tracked (null = not tracked). Never goes below zero.
create or replace function public.decrement_stock_on_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.product_variants v
  set stock = greatest(v.stock - i.quantity, 0)
  from (
    select product_id, color, size, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = new.id and product_id is not null
    group by product_id, color, size
  ) i
  where v.product_id = i.product_id and v.color = i.color and v.size = i.size and v.stock is not null;
  return new;
end;
$$;
revoke execute on function public.decrement_stock_on_paid() from public, anon, authenticated;

create trigger orders_decrement_stock_on_paid
  after update of status on public.orders
  for each row
  when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.decrement_stock_on_paid();

-- ---------- What the server (secret key) may do ----------
-- This project does not grant new tables to the API roles automatically.
grant select on public.admin_users to service_role;
grant select on public.regions to service_role;
grant select, insert, update on public.collections, public.products, public.product_colors,
  public.product_variants to service_role;
grant select, insert, update, delete on public.product_prices to service_role;
grant select, update on public.orders to service_role;
grant select on public.order_items, public.payment_attempts, public.shipping_rates to service_role;

-- ---------- Saving a product from the admin, in one transaction ----------
-- p: { id, is_new, collection_id, name, description, default_color, sort_order, is_active,
--      image_base?            (only when new photos were uploaded),
--      prices: { "LK": 350000 | null, "UK": ..., "US": ... }   (null removes that region's price),
--      stock:  { "black": { "S": 4 | null, ... }, "white": {...} }  (null = not tracked) }
-- New products get both colours and sizes S–XXL. Raises 'product_exists' / 'product_not_found'.
create or replace function public.admin_save_product(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := p->>'id';
  v_region record;
  v_color record;
  v_size record;
begin
  if coalesce((p->>'is_new')::boolean, false) then
    if exists (select 1 from public.products where id = v_id) then
      raise exception 'product_exists';
    end if;
    insert into public.products (id, collection_id, name, description, default_color, sort_order, is_active, image_base)
    values (v_id, p->>'collection_id', p->>'name', coalesce(p->>'description', ''), p->>'default_color',
            coalesce((p->>'sort_order')::integer, 0), coalesce((p->>'is_active')::boolean, true), p->>'image_base');
    insert into public.product_colors (product_id, color, label, sort_order)
    values (v_id, 'black', 'Black', 0), (v_id, 'white', 'White', 1);
    insert into public.product_variants (product_id, color, size)
    select v_id, c, s from unnest(array['black', 'white']) c cross join unnest(array['S', 'M', 'L', 'XL', 'XXL']) s;
  else
    update public.products set
      collection_id = p->>'collection_id',
      name = p->>'name',
      description = coalesce(p->>'description', ''),
      default_color = p->>'default_color',
      sort_order = coalesce((p->>'sort_order')::integer, sort_order),
      is_active = coalesce((p->>'is_active')::boolean, is_active),
      image_base = case when p ? 'image_base' then p->>'image_base' else image_base end
    where id = v_id;
    if not found then
      raise exception 'product_not_found';
    end if;
  end if;

  for v_region in select key, value from jsonb_each(coalesce(p->'prices', '{}'::jsonb)) loop
    if jsonb_typeof(v_region.value) = 'null' then
      delete from public.product_prices where product_id = v_id and region_code = v_region.key;
    else
      insert into public.product_prices (product_id, region_code, amount_minor)
      values (v_id, v_region.key, (v_region.value #>> '{}')::integer)
      on conflict (product_id, region_code) do update set amount_minor = excluded.amount_minor;
    end if;
  end loop;

  for v_color in select key, value from jsonb_each(coalesce(p->'stock', '{}'::jsonb)) loop
    for v_size in select key, value from jsonb_each(v_color.value) loop
      update public.product_variants set
        stock = case when jsonb_typeof(v_size.value) = 'null' then null else (v_size.value #>> '{}')::integer end
      where product_id = v_id and color = v_color.key and size = v_size.key;
    end loop;
  end loop;
end;
$$;
revoke execute on function public.admin_save_product(jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_product(jsonb) to service_role;
