-- À exécuter dans Supabase → SQL Editor (une seule fois)
-- Projet gratuit : https://supabase.com

create table if not exists public.tournaments (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists tournaments_updated_at_idx
  on public.tournaments (updated_at desc);

create index if not exists tournaments_broadcast_idx
  on public.tournaments ((data->>'broadcast'));

alter table public.tournaments enable row level security;

-- Aucune policy publique : seul le service role (API Vercel) accède aux données.
revoke all on public.tournaments from anon, authenticated;

-- Recharge le cache API (évite l'erreur « Invalid path » juste après création)
notify pgrst, 'reload schema';
