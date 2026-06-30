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

-- ── Portraits ────────────────────────────────────────────────────────────────

create table if not exists public.fighter_portraits (
  name text primary key,
  image_url text not null,
  storage_path text not null,
  updated_at timestamptz not null default now()
);

alter table public.fighter_portraits enable row level security;
revoke all on public.fighter_portraits from anon, authenticated;

-- Bucket public (lecture directe des images sur le site)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portraits',
  'portraits',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lecture publique des fichiers du bucket portraits
drop policy if exists "Public read portraits bucket" on storage.objects;
create policy "Public read portraits bucket"
on storage.objects for select
to public
using (bucket_id = 'portraits');

notify pgrst, 'reload schema';

-- ── Horaires d'ouverture ─────────────────────────────────────────────────────

create table if not exists public.opening_hours (
  id text primary key default 'main',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.opening_hours enable row level security;
revoke all on public.opening_hours from anon, authenticated;

notify pgrst, 'reload schema';
