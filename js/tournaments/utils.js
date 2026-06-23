export function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getRoundNames(totalRounds) {
  const names = [];
  for (let r = 1; r <= totalRounds; r += 1) {
    const remaining = totalRounds - r;
    if (remaining === 0) names.push('Finale');
    else if (remaining === 1) names.push('Demi-finales');
    else if (remaining === 2) names.push('Quarts de finale');
    else if (remaining === 3) names.push('8es de finale');
    else names.push(`Tour ${r}`);
  }
  return names;
}

export function participantById(tournament, id) {
  return tournament.participants.find((p) => p.id === id) || null;
}

export function participantName(tournament, id) {
  if (!id) return '—';
  const p = participantById(tournament, id);
  if (!p) return '—';
  if (p.forfeited) return `${p.name} (forfait)`;
  return p.name;
}

/** Nom court pour les cartes de match (premier mot uniquement). */
export function displayParticipantName(tournament, id) {
  if (!id) return 'En attente';
  const full = participantName(tournament, id);
  if (!full || full === '—') return 'En attente';
  if (full.endsWith(' (forfait)')) {
    const base = full.slice(0, -' (forfait)'.length);
    return `${truncateToFirstWord(base)} (forfait)`;
  }
  return truncateToFirstWord(full);
}

export function truncateToFirstWord(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return '—';
  return trimmed.split(/\s+/)[0];
}

export function findMatch(tournament, matchId) {
  return tournament.state.matches.find((m) => m.id === matchId) || null;
}

export function activeParticipants(tournament) {
  return tournament.participants.filter((p) => !p.forfeited);
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
