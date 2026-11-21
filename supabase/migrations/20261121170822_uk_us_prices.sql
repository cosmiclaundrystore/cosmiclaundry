-- Phase 3: UK and US shoppers see, and pay, their own currency.
-- Every tee gets £20.00 (UK) and $25.00 (US). Tees that already have a UK/US price keep it.
-- Change single tees later in the admin (Products -> a tee -> Prices).
insert into public.product_prices (product_id, region_code, amount_minor)
select p.id, r.region_code, r.amount_minor
from public.products p
cross join (values ('UK', 2000), ('US', 2500)) as r (region_code, amount_minor)
on conflict (product_id, region_code) do nothing;

-- PLACEHOLDER: UK and US delivery are not decided yet, so checkout adds no delivery fee for them.
-- Set the real fee in Supabase -> Table Editor -> shipping_rates (amount_minor is in pence / cents: 800 = £8.00).
insert into public.shipping_rates (region_code, amount_minor, label) values
  ('UK', 0, 'Delivery (confirmed after your order)'),
  ('US', 0, 'Delivery (confirmed after your order)')
on conflict (region_code) do nothing;
