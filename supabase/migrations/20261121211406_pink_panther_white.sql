-- Pink Panther tees show the white tee first.
update public.products set default_color = 'white' where collection_id = 'pink-panther';
