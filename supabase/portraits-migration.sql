-- Si vous avez déjà exécuté supabase/schema.sql pour les tournois,
-- exécutez UNIQUEMENT ce fichier dans SQL Editor.

create table if not exists public.fighter_portraits (
  name text primary key,
  image_url text not null,
  storage_path text not null,
  updated_at timestamptz not null default now()
);

alter table public.fighter_portraits enable row level security;
revoke all on public.fighter_portraits from anon, authenticated;

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

drop policy if exists "Public read portraits bucket" on storage.objects;
create policy "Public read portraits bucket"
on storage.objects for select
to public
using (bucket_id = 'portraits');

notify pgrst, 'reload schema';
