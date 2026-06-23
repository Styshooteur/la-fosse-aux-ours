import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { getSupabase, isSupabaseConfigured } from './supabase.js';

const LOCAL_DIR = join(process.cwd(), 'data', 'tournaments');
const LOCAL_INDEX = join(process.cwd(), 'data', 'tournaments-index.json');

function useLocalFiles() {
  return !isSupabaseConfigured();
}

function assertWritable() {
  if (useLocalFiles() && process.env.VERCEL) {
    throw new Error(
      'Stockage tournois non configuré sur Vercel. Créez un projet Supabase gratuit et ajoutez SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
}

function toSummary(t) {
  return {
    id: t.id,
    name: t.name,
    format: t.format,
    status: t.status,
    broadcast: Boolean(t.broadcast),
    participantCount: t.participants?.length || t.settings?.participantCount || 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function isLiveTournament(t) {
  return Boolean(t?.broadcast) && !t?.deleted;
}

function wrapSupabaseError(error) {
  if (!error) return error;
  const msg = error.message || '';
  const code = error.code || '';

  if (code === 'PGRST125' || /invalid path/i.test(msg)) {
    return new Error(
      'Connexion Supabase incorrecte. Vérifiez SUPABASE_URL sur Vercel : ' +
        'doit être https://xxxx.supabase.co uniquement (sans slash final, sans /rest/v1). ' +
        'Utilisez la clé service_role (legacy), pas la clé anon.'
    );
  }

  if (code === 'PGRST205' || /could not find.*table/i.test(msg)) {
    return new Error(
      'Table tournaments introuvable dans Supabase. ' +
        'Ouvrez SQL Editor et exécutez le fichier supabase/schema.sql, puis attendez 1 minute.'
    );
  }

  return error;
}

// ── Local filesystem (start.bat) ────────────────────────────────────────────

function loadIndexLocal() {
  if (!existsSync(LOCAL_INDEX)) return [];
  return JSON.parse(readFileSync(LOCAL_INDEX, 'utf-8')).tournaments || [];
}

function saveIndexLocal(entries) {
  mkdirSync(LOCAL_DIR, { recursive: true });
  writeFileSync(LOCAL_INDEX, JSON.stringify({ tournaments: entries }, null, 2), 'utf-8');
}

function loadTournamentLocal(id) {
  const path = join(LOCAL_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveTournamentLocal(tournament) {
  mkdirSync(LOCAL_DIR, { recursive: true });
  writeFileSync(
    join(LOCAL_DIR, `${tournament.id}.json`),
    JSON.stringify(tournament, null, 2),
    'utf-8'
  );
}

function deleteTournamentLocal(id) {
  const path = join(LOCAL_DIR, `${id}.json`);
  if (existsSync(path)) unlinkSync(path);
}

// ── Supabase ────────────────────────────────────────────────────────────────

async function listAllFromSupabase() {
  const { data, error } = await getSupabase()
    .from('tournaments')
    .select('data')
    .order('updated_at', { ascending: false });

  if (error) throw wrapSupabaseError(error);
  return (data || []).map((row) => row.data).filter((t) => t && !t.deleted);
}

async function getTournamentFromSupabase(id) {
  const { data, error } = await getSupabase()
    .from('tournaments')
    .select('data')
    .eq('id', id)
    .maybeSingle();

  if (error) throw wrapSupabaseError(error);
  return data?.data || null;
}

async function saveTournamentToSupabase(tournament) {
  const { error } = await getSupabase()
    .from('tournaments')
    .upsert(
      {
        id: tournament.id,
        data: tournament,
        updated_at: tournament.updatedAt || new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (error) throw wrapSupabaseError(error);
}

async function deleteTournamentFromSupabase(id) {
  const { error } = await getSupabase().from('tournaments').delete().eq('id', id);
  if (error) throw wrapSupabaseError(error);
}

// ── Public API ──────────────────────────────────────────────────────────────

export function liveTournamentsSignature(tournaments) {
  return tournaments
    .map((t) => `${t.id}:${t.updatedAt}:${Boolean(t.broadcast)}`)
    .sort()
    .join('|');
}

export async function getLiveTournamentsRevision() {
  if (useLocalFiles()) {
    return loadIndexLocal()
      .filter((t) => t.broadcast)
      .map((t) => `${t.id}:${t.updatedAt}:${Boolean(t.broadcast)}`)
      .sort()
      .join('|');
  }

  const tournaments = await listAllFromSupabase();
  return tournaments
    .filter(isLiveTournament)
    .map((t) => `${t.id}:${t.updatedAt}:${Boolean(t.broadcast)}`)
    .sort()
    .join('|');
}

export async function listLiveTournamentsFull() {
  if (useLocalFiles()) {
    const live = loadIndexLocal().filter((t) => t.broadcast);
    const tournaments = [];
    for (const entry of live) {
      const full = loadTournamentLocal(entry.id);
      if (full && !full.deleted) tournaments.push(full);
    }
    tournaments.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return tournaments;
  }

  return (await listAllFromSupabase())
    .filter(isLiveTournament)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function listTournaments() {
  if (useLocalFiles()) {
    return loadIndexLocal().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  return (await listAllFromSupabase()).map(toSummary);
}

export async function getTournament(id) {
  if (useLocalFiles()) {
    return loadTournamentLocal(id);
  }
  return getTournamentFromSupabase(id);
}

export async function saveTournament(tournament) {
  assertWritable();

  if (useLocalFiles()) {
    saveTournamentLocal(tournament);
    const index = loadIndexLocal();
    const summary = toSummary(tournament);
    const existing = index.findIndex((t) => t.id === tournament.id);
    if (existing >= 0) index[existing] = summary;
    else index.push(summary);
    saveIndexLocal(index);
    return tournament;
  }

  await saveTournamentToSupabase(tournament);
  return tournament;
}

export async function deleteTournament(id) {
  assertWritable();

  if (useLocalFiles()) {
    deleteTournamentLocal(id);
    saveIndexLocal(loadIndexLocal().filter((t) => t.id !== id));
    return;
  }

  await deleteTournamentFromSupabase(id);
}

export async function loadAllTournamentsLocal() {
  if (useLocalFiles()) {
    if (!existsSync(LOCAL_DIR)) return [];
    const files = readdirSync(LOCAL_DIR).filter((f) => f.endsWith('.json'));
    return files
      .map((f) => JSON.parse(readFileSync(join(LOCAL_DIR, f), 'utf-8')))
      .filter(Boolean)
      .map(toSummary);
  }

  return listTournaments();
}
