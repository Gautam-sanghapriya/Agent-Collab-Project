create table if not exists public.app_storage (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_storage enable row level security;

drop policy if exists "app_storage_select_all" on public.app_storage;
drop policy if exists "app_storage_insert_all" on public.app_storage;
drop policy if exists "app_storage_update_all" on public.app_storage;
drop policy if exists "app_storage_delete_all" on public.app_storage;

create policy "app_storage_select_all"
on public.app_storage
for select
to anon
using (true);

create policy "app_storage_insert_all"
on public.app_storage
for insert
to anon
with check (true);

create policy "app_storage_update_all"
on public.app_storage
for update
to anon
using (true)
with check (true);

create policy "app_storage_delete_all"
on public.app_storage
for delete
to anon
using (true);
