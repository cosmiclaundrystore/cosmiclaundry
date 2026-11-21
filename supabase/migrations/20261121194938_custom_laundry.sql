-- Custom Laundry: customers email their own design (PNG + instructions) and we print it on a plain oversized tee.
-- The shop shows "Email us" instead of the basket for this Laundry (public/app.js, public/commerce.js: collection "custom").
insert into public.collections (id, name, short_name, tagline, description, featured_product_id, tint, accent, theme, sort_order, show_on_home)
select 'custom', 'Custom Laundry', 'Custom', 'Your design. Our tee.',
       'Send us your design as a PNG and tell us how you want it. We print it on our oversized tee, in black or white.',
       null, '#142d49', '#6b6b6b', 'custom', coalesce(max(sort_order), 0) + 10, false
from public.collections;

insert into public.products (id, collection_id, name, description, default_color, sort_order)
values ('custom-tee', 'custom', 'Your Design', 'Your own artwork on an oversized tee. Email us the PNG and instructions the way you want it.', 'black', 10);

insert into public.product_colors (product_id, color, label, sort_order)
values ('custom-tee', 'black', 'Black', 0), ('custom-tee', 'white', 'White', 1);

insert into public.product_variants (product_id, color, size)
select 'custom-tee', c, s from unnest(array['black', 'white']) c cross join unnest(array['S', 'M', 'L', 'XL', 'XXL']) s;

-- 4,999 LKR / £29.99 / $39.99 (amount_minor is in cents / pence).
insert into public.product_prices (product_id, region_code, amount_minor)
values ('custom-tee', 'LK', 499900), ('custom-tee', 'UK', 2999), ('custom-tee', 'US', 3999);

update public.collections set featured_product_id = 'custom-tee' where id = 'custom';
