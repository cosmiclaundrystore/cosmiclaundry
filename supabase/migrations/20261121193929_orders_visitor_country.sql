-- Fraud check for regional prices: remember which country the shopper was connecting from (Vercel's geo header),
-- so the admin can flag orders where it doesn't match the region they paid in (e.g. a UK connection paying the LK price).
alter table public.orders add column visitor_country char(2);

-- Same as before, plus visitor_country.
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
revoke execute on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;
