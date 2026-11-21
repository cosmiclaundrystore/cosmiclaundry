-- Remove the Meme Laundry and all its tees. Their colours, sizes and prices go with them (on delete cascade).
-- No orders contained a meme tee when this was written.
delete from public.products where collection_id = 'memes';
delete from public.collections where id = 'memes';
