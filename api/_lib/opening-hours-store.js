import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { defaultSchedule, sanitizeSchedule } from './opening-hours-validate.js';

const LOCAL_PATH = join(process.cwd(), 'data', 'opening-hours.json');
const ROW_ID = 'main';

function useLocalFiles() {
  return !isSupabaseConfigured();
}

function assertWritable() {
  if (useLocalFiles() && process.env.VERCEL) {
    throw new Error(
      'Stockage horaires non configuré sur Vercel. Ajoutez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
}

function wrapSupabaseError(error) {
  if (!error) return error;
  const msg = error.message || '';
  const code = error.code || '';

  if (code === 'PGRST205' || /could not find.*table/i.test(msg)) {
    return new Error(
      'Table opening_hours introuvable dans Supabase. Exécutez supabase/opening-hours-migration.sql.'
    );
  }

  return error;
}

function loadLocal() {
  if (!existsSync(LOCAL_PATH)) {
    return { schedule: defaultSchedule(), updatedAt: null };
  }
  try {
    const data = JSON.parse(readFileSync(LOCAL_PATH, 'utf-8'));
    return {
      schedule: data.schedule || defaultSchedule(),
      updatedAt: data.updatedAt || null,
    };
  } catch {
    return { schedule: defaultSchedule(), updatedAt: null };
  }
}

function saveLocal(payload) {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  writeFileSync(LOCAL_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

async function loadFromSupabase() {
  const { data, error } = await getSupabase()
    .from('opening_hours')
    .select('data, updated_at')
    .eq('id', ROW_ID)
    .maybeSingle();

  if (error) throw wrapSupabaseError(error);
  if (!data?.data) {
    return { schedule: defaultSchedule(), updatedAt: null };
  }

  return {
    schedule: data.data.schedule || defaultSchedule(),
    updatedAt: data.data.updatedAt || data.updated_at || null,
  };
}

async function saveToSupabase(payload) {
  const { error } = await getSupabase()
    .from('opening_hours')
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

export async function getOpeningHours() {
  if (useLocalFiles()) {
    return loadLocal();
  }
  return loadFromSupabase();
}

export async function saveOpeningHours(schedule) {
  assertWritable();
  const sanitized = sanitizeSchedule(schedule);
  const payload = {
    schedule: sanitized,
    updatedAt: new Date().toISOString(),
  };

  if (useLocalFiles()) {
    saveLocal(payload);
    return payload;
  }

  await saveToSupabase(payload);
  return payload;
}
