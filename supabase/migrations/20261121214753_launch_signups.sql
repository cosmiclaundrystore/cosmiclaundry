-- Emails left on the coming-soon page. Private: no API policies; only the server (secret key) writes and reads them.
create table public.launch_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and length(email) between 3 and 254 and position('@' in email) > 1),
  country_code char(2),
  created_at timestamptz not null default now(),
  constraint launch_signups_email_key unique (email)
);
alter table public.launch_signups enable row level security;
revoke all on public.launch_signups from anon, authenticated;
grant select, insert on public.launch_signups to service_role;
