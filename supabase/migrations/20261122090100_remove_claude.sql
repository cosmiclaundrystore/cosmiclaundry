-- Remove the Claude Laundry and all its tees (colours, sizes and prices go with them). No orders contained them.
delete from public.products where collection_id = 'claude';
delete from public.collections where id = 'claude';
