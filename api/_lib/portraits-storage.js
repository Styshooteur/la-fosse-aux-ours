import { getSupabase, isSupabaseConfigured, normalizeSupabaseUrl } from './supabase.js';

export const PORTRAITS_BUCKET = 'portraits';

export function isPortraitsStorageConfigured() {
  return isSupabaseConfigured();
}

export function portraitPublicUrl(storagePath) {
  const base = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  return `${base}/storage/v1/object/public/${PORTRAITS_BUCKET}/${storagePath}`;
}

export async function uploadPortraitFile(storagePath, buffer, contentType) {
  const { error } = await getSupabase()
    .storage.from(PORTRAITS_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) throw error;
  return portraitPublicUrl(storagePath);
}

export async function downloadPortraitFile(storagePath) {
  const { data, error } = await getSupabase()
    .storage.from(PORTRAITS_BUCKET)
    .download(storagePath);

  if (error) throw error;

  const buffer = Buffer.from(await data.arrayBuffer());
  return {
    buffer,
    contentType: data.type || 'application/octet-stream',
  };
}

export async function deletePortraitFile(storagePath) {
  const { error } = await getSupabase()
    .storage.from(PORTRAITS_BUCKET)
    .remove([storagePath]);

  if (error) throw error;
}

export function portraitsSetupHint() {
  return (
    'Stockage portraits non configuré. Exécutez supabase/schema.sql (table fighter_portraits + bucket portraits), ' +
    'puis vérifiez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sur Vercel.'
  );
}
