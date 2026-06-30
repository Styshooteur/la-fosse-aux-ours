-- Horaires d'ouverture de l'arène — à exécuter dans Supabase → SQL Editor

create table if not exists public.opening_hours (
  id text primary key default 'main',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.opening_hours enable row level security;
revoke all on public.opening_hours from anon, authenticated;

notify pgrst, 'reload schema';
