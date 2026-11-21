-- Custom tees: the customer uploads their design (PNG/JPG/WebP) in the tee window and pays at checkout.
-- Files live in Storage (not the database). The bucket is private: only the server (secret key) reads and writes it.
-- Unpaid uploads are deleted after 24 hours, and designs 30 days after the order is delivered (app/api/cron/clean-designs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('custom-designs', 'custom-designs', false, 5242880, array['image/png', 'image/webp'])
on conflict (id) do nothing;

-- Which uploaded design goes on this line, and how the customer wants it.
alter table public.order_items
  add column design_path text,
  add column design_note text check (design_note is null or char_length(design_note) <= 500);

-- Same as before, plus each line's design.
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
    access_token_hash, visitor_country
  ) values (
    p->>'region_code', p->>'currency', (p->>'subtotal_minor')::integer, (p->>'shipping_minor')::integer,
    (p->>'total_minor')::integer,
    p->>'email', p->>'phone', p->>'first_name', p->>'last_name', p->>'address_line1', nullif(p->>'address_line2', ''),
    p->>'city', p->>'postcode', p->>'country_code', nullif(p->>'notes', ''),
    p->>'access_token_hash', upper(nullif(p->>'visitor_country', ''))
  )
  returning * into v_order;

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
revoke execute on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;
