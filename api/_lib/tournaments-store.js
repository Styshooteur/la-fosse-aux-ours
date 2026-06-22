import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { isBlobConfigured, putBlob, readBlobJson } from './blob.js';
import { TOURNAMENTS_INDEX_BLOB, tournamentBlobPath } from './config.js';

const LOCAL_DIR = join(process.cwd(), 'data', 'tournaments');
const LOCAL_INDEX = join(process.cwd(), 'data', 'tournaments-index.json');

function useBlob() {
  return isBlobConfigured();
}

async function loadIndex() {
  if (useBlob()) {
    const data = await readBlobJson(TOURNAMENTS_INDEX_BLOB);
    return data?.tournaments || [];
  }

  if (!existsSync(LOCAL_INDEX)) return [];
  return JSON.parse(readFileSync(LOCAL_INDEX, 'utf-8')).tournaments || [];
}

async function saveIndex(entries) {
  const payload = JSON.stringify({ tournaments: entries }, null, 2);
  if (useBlob()) {
    await putBlob(TOURNAMENTS_INDEX_BLOB, payload, 'application/json');
    return;
  }

  mkdirSync(LOCAL_DIR, { recursive: true });
  writeFileSync(LOCAL_INDEX, payload, 'utf-8');
}

async function loadTournamentFile(id) {
  if (useBlob()) {
    return readBlobJson(tournamentBlobPath(id));
  }

  const path = join(LOCAL_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

async function saveTournamentFile(tournament) {
  const payload = JSON.stringify(tournament, null, 2);
  if (useBlob()) {
    await putBlob(tournamentBlobPath(tournament.id), payload, 'application/json');
    return;
  }

  mkdirSync(LOCAL_DIR, { recursive: true });
  writeFileSync(join(LOCAL_DIR, `${tournament.id}.json`), payload, 'utf-8');
}

async function deleteTournamentFile(id) {
  if (useBlob()) {
    await putBlob(tournamentBlobPath(id), JSON.stringify({ deleted: true }), 'application/json');
    return;
  }

  const path = join(LOCAL_DIR, `${id}.json`);
  if (existsSync(path)) unlinkSync(path);
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

export function liveTournamentsSignature(tournaments) {
  return tournaments
    .map((t) => `${t.id}:${t.updatedAt}:${Boolean(t.broadcast)}`)
    .sort()
    .join('|');
}

export async function listLiveTournamentsFull() {
  const index = await loadIndex();
  const live = index.filter((t) => t.broadcast);
  const tournaments = [];

  for (const entry of live) {
    const full = await loadTournamentFile(entry.id);
    if (full && !full.deleted) {
      tournaments.push(full);
    }
  }

  tournaments.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return tournaments;
}

export async function listTournaments() {
  const index = await loadIndex();
  return index.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function getTournament(id) {
  return loadTournamentFile(id);
}

export async function saveTournament(tournament) {
  await saveTournamentFile(tournament);

  const index = await loadIndex();
  const summary = toSummary(tournament);
  const existing = index.findIndex((t) => t.id === tournament.id);

  if (existing >= 0) index[existing] = summary;
  else index.push(summary);

  await saveIndex(index);
  return tournament;
}

export async function deleteTournament(id) {
  await deleteTournamentFile(id);
  const index = await loadIndex();
  await saveIndex(index.filter((t) => t.id !== id));
}

export async function loadAllTournamentsLocal() {
  if (useBlob()) return listTournaments();

  if (!existsSync(LOCAL_DIR)) return [];
  const files = readdirSync(LOCAL_DIR).filter((f) => f.endsWith('.json'));
  const tournaments = files
    .map((f) => JSON.parse(readFileSync(join(LOCAL_DIR, f), 'utf-8')))
    .filter(Boolean);
  return tournaments.map(toSummary);
}
