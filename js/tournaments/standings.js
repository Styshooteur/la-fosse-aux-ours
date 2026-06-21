import { participantById } from './utils.js';

export function emptyStanding(participantId) {
  return {
    participantId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    diff: 0,
    pts: 0,
    buchholz: 0,
    opponents: [],
  };
}

export function computeStandings(tournament, { groupId = null, onlyCompleted = true } = {}) {
  const stats = new Map();
  for (const p of tournament.participants) {
    if (p.forfeited) continue;
    stats.set(p.id, emptyStanding(p.id));
  }

  const matches = tournament.state.matches.filter((m) => {
    if (groupId !== null && m.groupId !== groupId) return false;
    if (onlyCompleted && m.status !== 'completed') return false;
    return m.participantAId && m.participantBId;
  });

  for (const m of matches) {
    const a = stats.get(m.participantAId);
    const b = stats.get(m.participantBId);
    if (!a || !b) continue;

    a.played += 1;
    b.played += 1;
    a.goalsFor += m.scoreA ?? 0;
    a.goalsAgainst += m.scoreB ?? 0;
    b.goalsFor += m.scoreB ?? 0;
    b.goalsAgainst += m.scoreA ?? 0;

    if (!a.opponents.includes(m.participantBId)) a.opponents.push(m.participantBId);
    if (!b.opponents.includes(m.participantAId)) b.opponents.push(m.participantAId);

    if (m.scoreA === m.scoreB) {
      a.draws += 1;
      b.draws += 1;
      a.pts += 1;
      b.pts += 1;
    } else if (m.winnerId === m.participantAId) {
      a.wins += 1;
      b.losses += 1;
      a.pts += 3;
    } else if (m.winnerId === m.participantBId) {
      b.wins += 1;
      a.losses += 1;
      b.pts += 3;
    }
  }

  const rows = [...stats.values()].map((row) => ({
    ...row,
    diff: row.goalsFor - row.goalsAgainst,
    name: participantById(tournament, row.participantId)?.name || '—',
    color: participantById(tournament, row.participantId)?.color || null,
  }));

  for (const row of rows) {
    row.buchholz = row.opponents.reduce((sum, oppId) => {
      const opp = rows.find((r) => r.participantId === oppId);
      return sum + (opp?.pts || 0);
    }, 0);
  }

  return sortStandings(rows);
}

export function sortStandings(rows) {
  return [...rows].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name, 'fr');
  });
}
