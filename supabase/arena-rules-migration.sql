-- Règles de l'arène — à exécuter dans Supabase → SQL Editor

create table if not exists public.arena_rules (
  id text primary key default 'main',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.arena_rules enable row level security;
revoke all on public.arena_rules from anon, authenticated;

notify pgrst, 'reload schema';
