import { join, resolve } from 'node:path';

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ALLOWED_FORMATS = new Set([
  'single-elimination',
  'double-elimination',
  'round-robin',
  'group-stage',
  'swiss',
]);
const MAX_JSON_BYTES = 2_000_000;
const DEFAULT_COLOR = '#8f6118';

export function validateTournamentId(id) {
  if (!id || typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new Error('Identifiant de tournoi invalide.');
  }
}

export function assertSafeTournamentPath(id, baseDir) {
  validateTournamentId(id);
  const base = resolve(baseDir);
  const target = resolve(join(baseDir, `${id}.json`));
  if (!target.startsWith(base + join.sep) && target !== base) {
    throw new Error('Chemin de tournoi invalide.');
  }
}

export function sanitizeHexColor(color, fallback = DEFAULT_COLOR) {
  if (typeof color === 'string' && HEX_COLOR.test(color)) return color;
  return fallback;
}

export function sanitizeTournamentPayload(tournament) {
  if (!tournament || typeof tournament !== 'object') {
    throw new Error('Données de tournoi invalides.');
  }

  validateTournamentId(tournament.id);

  if (!tournament.name || typeof tournament.name !== 'string') {
    throw new Error('Nom de tournoi requis.');
  }
  if (tournament.name.length > 200) {
    throw new Error('Nom de tournoi trop long.');
  }

  if (tournament.format && !ALLOWED_FORMATS.has(tournament.format)) {
    throw new Error('Format de tournoi non reconnu.');
  }

  if (Array.isArray(tournament.participants)) {
    if (tournament.participants.length > 64) {
      throw new Error('Trop de participants.');
    }
    for (const p of tournament.participants) {
      if (p && typeof p === 'object' && 'color' in p) {
        p.color = sanitizeHexColor(p.color);
      }
      if (p?.name && typeof p.name === 'string' && p.name.length > 120) {
        throw new Error('Nom de participant trop long.');
      }
    }
  }

  if (tournament.state?.matches && !Array.isArray(tournament.state.matches)) {
    throw new Error('Structure de matchs invalide.');
  }

  if (tournament.state?.matches?.length > 500) {
    throw new Error('Trop de matchs dans le tournoi.');
  }

  const size = Buffer.byteLength(JSON.stringify(tournament), 'utf8');
  if (size > MAX_JSON_BYTES) {
    throw new Error('Tournoi trop volumineux.');
  }

  return tournament;
}
