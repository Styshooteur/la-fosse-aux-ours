import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { portraitsSetupHint, deletePortraitFile } from './portraits-storage.js';

const LOCAL_REGISTRY = join(process.cwd(), 'data', 'fighters-registry.json');

function loadBaseFighters() {
  try {
    const path = join(process.cwd(), 'data', 'fighters.json');
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return data.fighters || {};
  } catch {
    return {};
  }
}

function wrapSupabaseError(error) {
  if (!error) return error;
  const msg = error.message || '';
  const code = error.code || '';

  if (code === 'PGRST205' || /fighter_portraits/i.test(msg)) {
    return new Error(
      'Table fighter_portraits introuvable. Exécutez supabase/schema.sql dans le SQL Editor Supabase.'
    );
  }

  return error;
}

function loadRegistryOverlayLocal() {
  if (!existsSync(LOCAL_REGISTRY)) return {};
  try {
    return JSON.parse(readFileSync(LOCAL_REGISTRY, 'utf-8')).fighters || {};
  } catch {
    return {};
  }
}

function saveRegistryOverlayLocal(overlay) {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  writeFileSync(LOCAL_REGISTRY, JSON.stringify({ fighters: overlay }, null, 2), 'utf-8');
}

async function loadRegistryOverlaySupabase() {
  const { data, error } = await getSupabase()
    .from('fighter_portraits')
    .select('name, image_url');

  if (error) throw wrapSupabaseError(error);

  const overlay = {};
  for (const row of data || []) {
    overlay[row.name] = { image: row.image_url };
  }
  return overlay;
}

async function loadRegistryOverlay() {
  if (isSupabaseConfigured()) {
    return loadRegistryOverlaySupabase();
  }
  return loadRegistryOverlayLocal();
}

export async function listCustomPortraitNames() {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase().from('fighter_portraits').select('name');
    if (error) throw wrapSupabaseError(error);
    return (data || []).map((row) => row.name);
  }
  return Object.keys(loadRegistryOverlayLocal());
}

export async function getFightersMap() {
  const base = loadBaseFighters();
  const overlay = await loadRegistryOverlay();
  return { ...base, ...overlay };
}

export async function saveFighterPortrait(name, imageUrl, storagePath = null) {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase()
      .from('fighter_portraits')
      .upsert(
        {
          name,
          image_url: imageUrl,
          storage_path: storagePath || imageUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'name' }
      );

    if (error) throw wrapSupabaseError(error);
    return imageUrl;
  }

  if (process.env.VERCEL) {
    throw new Error(portraitsSetupHint());
  }

  const overlay = loadRegistryOverlayLocal();
  overlay[name] = { image: imageUrl };
  saveRegistryOverlayLocal(overlay);
  return imageUrl;
}

export async function deleteFighterPortrait(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    throw new Error('Nom du combattant manquant.');
  }

  if (isSupabaseConfigured()) {
    const { data, error: fetchError } = await getSupabase()
      .from('fighter_portraits')
      .select('storage_path')
      .eq('name', trimmed)
      .maybeSingle();

    if (fetchError) throw wrapSupabaseError(fetchError);
    if (!data) {
      throw new Error('Aucun portrait personnalisé à supprimer pour ce combattant.');
    }

    if (data.storage_path && !data.storage_path.startsWith('http')) {
      try {
        await deletePortraitFile(data.storage_path);
      } catch {
        /* fichier déjà absent */
      }
    }

    const { error } = await getSupabase().from('fighter_portraits').delete().eq('name', trimmed);
    if (error) throw wrapSupabaseError(error);
    return;
  }

  if (process.env.VERCEL) {
    throw new Error(portraitsSetupHint());
  }

  const overlay = loadRegistryOverlayLocal();
  if (!overlay[trimmed]) {
    throw new Error('Aucun portrait personnalisé à supprimer pour ce combattant.');
  }

  delete overlay[trimmed];
  saveRegistryOverlayLocal(overlay);
}
