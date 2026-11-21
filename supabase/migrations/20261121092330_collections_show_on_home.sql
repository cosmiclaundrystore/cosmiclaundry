-- Whether a Laundry's tees appear in the home page hero and tee strip. Every Laundry stays in the menu,
-- All Laundries and its own page either way.
alter table public.collections add column show_on_home boolean not null default true;
