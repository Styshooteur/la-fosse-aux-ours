import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabase, isSupabaseConfigured } from './supabase.js';
import {
  defaultArenaRules,
  buildArenaRulesPayload,
  sanitizeArenaRules,
} from './arena-rules-validate.js';

const LOCAL_PATH = join(process.cwd(), 'data', 'arena-rules.json');
const ROW_ID = 'main';

function useLocalFiles() {
  return !isSupabaseConfigured();
}

function assertWritable() {
  if (useLocalFiles() && process.env.VERCEL) {
    throw new Error(
      'Stockage règles non configuré sur Vercel. Ajoutez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
}

function wrapSupabaseError(error) {
  if (!error) return error;
  const msg = error.message || '';
  const code = error.code || '';

  if (code === 'PGRST205' || /could not find.*table/i.test(msg)) {
    return new Error(
      'Table arena_rules introuvable dans Supabase. Exécutez supabase/arena-rules-migration.sql.'
    );
  }

  return error;
}

function normalizePayload(data) {
  const base = defaultArenaRules();
  if (!data) return base;
  return {
    announcements: data.announcements || '',
    importantRules: data.importantRules || '',
    body: data.body || '',
    updatedAt: data.updatedAt || null,
    announcementsUpdatedAt: data.announcementsUpdatedAt || data.updatedAt || null,
  };
}

function loadLocal() {
  if (!existsSync(LOCAL_PATH)) {
    return defaultArenaRules();
  }
  try {
    return normalizePayload(JSON.parse(readFileSync(LOCAL_PATH, 'utf-8')));
  } catch {
    return defaultArenaRules();
  }
}

function saveLocal(payload) {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  writeFileSync(LOCAL_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

async function loadFromSupabase() {
  const { data, error } = await getSupabase()
    .from('arena_rules')
    .select('data, updated_at')
    .eq('id', ROW_ID)
    .maybeSingle();

  if (error) throw wrapSupabaseError(error);
  if (!data?.data) return defaultArenaRules();

  return normalizePayload({
    ...data.data,
    updatedAt: data.data.updatedAt || data.updated_at || null,
  });
}

async function saveToSupabase(payload) {
  const { error } = await getSupabase()
    .from('arena_rules')
    .upsert(
      {
        id: ROW_ID,
        data: payload,
        updated_at: payload.updatedAt,
      },
      { onConflict: 'id' }
    );

  if (error) throw wrapSupabaseError(error);
}

export async function getArenaRules() {
  if (useLocalFiles()) {
    return loadLocal();
  }
  return loadFromSupabase();
}

export async function saveArenaRules(sections) {
  assertWritable();
  const existing = useLocalFiles() ? loadLocal() : await loadFromSupabase();
  const sanitized = sanitizeArenaRules(sections);
  const payload = buildArenaRulesPayload(sanitized, existing);

  if (useLocalFiles()) {
    saveLocal(payload);
    return payload;
  }

  await saveToSupabase(payload);
  return payload;
}
