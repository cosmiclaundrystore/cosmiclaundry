-- Sri Lanka island-wide delivery: 500 LKR (amount_minor is in cents: 50000 = 500.00 LKR).
update public.shipping_rates set amount_minor = 50000 where region_code = 'LK';
