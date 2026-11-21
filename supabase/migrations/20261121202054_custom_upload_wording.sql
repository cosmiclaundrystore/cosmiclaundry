-- Custom Laundry: customers now upload their design in the tee window (no email needed).
update public.collections
set description = 'Upload your design as a PNG and tell us how you want it. We print it on our oversized tee, in black or white.'
where id = 'custom';
update public.products
set description = 'Your own artwork on an oversized tee. Upload your design and tell us how you want it.'
where id = 'custom-tee';
