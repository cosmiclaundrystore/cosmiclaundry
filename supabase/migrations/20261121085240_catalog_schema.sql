-- Cosmic Laundry catalog: regions, collections ("Laundries"), products, colours, size variants and regional prices.
-- The storefront reads this with the publishable key (read-only, RLS below).
-- Writes happen only from the server with the secret key (admin dashboard, Phase 5).

-- Keeps updated_at current on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Selling regions and their currency (prices are set per region, not converted).
create table public.regions (
  code text primary key check (code in ('LK', 'UK', 'US')),
  name text not null,
  currency char(3) not null check (currency in ('LKR', 'GBP', 'USD')),
  is_default boolean not null default false,
  sort_order integer not null default 0
);
create unique index regions_one_default on public.regions (is_default) where is_default;

-- Laundries. `id` is the URL slug used by the storefront (#/laundry/<id>).
create table public.collections (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  short_name text not null,
  tagline text not null default '',
  description text not null default '',
  featured_product_id text,
  tint text not null,
  accent text not null,
  theme text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  collection_id text not null references public.collections (id) on update cascade on delete restrict,
  name text not null,
  description text not null default '',
  default_color text not null check (default_color in ('black', 'white')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_collection_id_idx on public.products (collection_id);

-- The featured tee of each Laundry. Deferred so a Laundry and its tees can be added in one transaction.
alter table public.collections
  add constraint collections_featured_product_id_fkey
  foreign key (featured_product_id) references public.products (id)
  on update cascade on delete set null
  deferrable initially deferred;
create index collections_featured_product_id_idx on public.collections (featured_product_id);

-- Garment colours each tee is offered in (images follow assets/products/<product>-<color>.webp).
create table public.product_colors (
  product_id text not null references public.products (id) on update cascade on delete cascade,
  color text not null check (color in ('black', 'white')),
  label text not null,
  sort_order integer not null default 0,
  primary key (product_id, color)
);

-- Sellable size per colour. stock = null means stock is not tracked yet.
create table public.product_variants (
  id bigint generated always as identity primary key,
  product_id text not null,
  color text not null,
  size text not null check (size in ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL')),
  stock integer check (stock is null or stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color, size),
  foreign key (product_id, color) references public.product_colors (product_id, color) on update cascade on delete cascade
);

-- Price per product per region, in minor units of the region's currency (LKR 3,500.00 = 350000).
create table public.product_prices (
  product_id text not null references public.products (id) on update cascade on delete cascade,
  region_code text not null references public.regions (code) on update cascade on delete restrict,
  amount_minor integer not null check (amount_minor > 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, region_code)
);
create index product_prices_region_code_idx on public.product_prices (region_code);

create trigger collections_set_updated_at before update on public.collections
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger product_prices_set_updated_at before update on public.product_prices
  for each row execute function public.set_updated_at();

-- Row level security: the public may read active catalog rows; nobody may write through the API.
alter table public.regions enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_colors enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_prices enable row level security;

create policy "Anyone can read regions" on public.regions
  for select to anon, authenticated using (true);

create policy "Anyone can read active collections" on public.collections
  for select to anon, authenticated using (is_active);

create policy "Anyone can read active products" on public.products
  for select to anon, authenticated using (is_active);

create policy "Anyone can read colours of active products" on public.product_colors
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active));

create policy "Anyone can read active variants of active products" on public.product_variants
  for select to anon, authenticated
  using (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active));

create policy "Anyone can read prices of active products" on public.product_prices
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active));

-- Table privileges: read-only for the public roles (RLS still filters the rows).
revoke all on public.regions, public.collections, public.products,
  public.product_colors, public.product_variants, public.product_prices
  from anon, authenticated;
grant select on public.regions, public.collections, public.products,
  public.product_colors, public.product_variants, public.product_prices
  to anon, authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
