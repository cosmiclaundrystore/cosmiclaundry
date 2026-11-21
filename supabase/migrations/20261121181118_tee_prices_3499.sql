-- New standard tee price: 3,499 LKR / £19.99 / $24.99, for every tee (amount_minor is in cents / pence).
-- Single tees can still be changed in the admin afterwards.
update public.product_prices set amount_minor = case region_code
  when 'LK' then 349900
  when 'UK' then 1999
  when 'US' then 2499
end
where region_code in ('LK', 'UK', 'US');
