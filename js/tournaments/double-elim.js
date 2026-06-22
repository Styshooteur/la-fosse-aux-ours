import { FORMATS } from './types.js';
import { generateId, getRoundNames, shuffle } from './utils.js';

function createMatch(round, roundName, bracket, extra = {}) {
  return {
    id: generateId('m'),
    round,
    roundName,
    bracket,
    participantAId: null,
    participantBId: null,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserNextMatchId: null,
    loserNextSlot: null,
    groupId: null,
    swissRound: null,
    ...extra,
  };
}

function linkWinner(from, to, slot) {
  from.nextMatchId = to.id;
  from.nextSlot = slot;
}

function linkLoser(from, to, slot) {
  from.loserNextMatchId = to.id;
  from.loserNextSlot = slot;
}

/**
 * Double élimination standard (4 / 8 / 16 / 32 joueurs).
 * Structure claire : Winner Bracket + Loser Bracket (repêchage) + Grande finale.
 */
export function generateDoubleElimination(participants, seedMode = 'random') {
  let ordered = [...participants];
  if (seedMode === 'random') ordered = shuffle(ordered);

  const n = ordered.length;
  const wbRounds = Math.log2(n);
  const wbNames = getRoundNames(wbRounds);
  const matches = [];
  const wbByRound = [];
  const lbByRound = [];

  let prev = [];
  for (let i = 0; i < n / 2; i += 1) {
    const m = createMatch(1, `Vainqueurs — ${wbNames[0]}`, 'winner', {
      wbRound: 1,
      participantAId: ordered[i * 2].id,
      participantBId: ordered[i * 2 + 1].id,
    });
    matches.push(m);
    prev.push(m);
  }
  wbByRound.push(prev);

  for (let r = 2; r <= wbRounds; r += 1) {
    const current = [];
    for (let i = 0; i < prev.length / 2; i += 1) {
      const m = createMatch(r, `Vainqueurs — ${wbNames[r - 1]}`, 'winner', { wbRound: r });
      linkWinner(prev[i * 2], m, 'A');
      linkWinner(prev[i * 2 + 1], m, 'B');
      matches.push(m);
      current.push(m);
    }
    prev = current;
    wbByRound.push(current);
  }

  let lbRound = 1;
  const lb1 = [];
  for (let i = 0; i < n / 4; i += 1) {
    const m = createMatch(lbRound, `Repêchage — Tour 1`, 'loser', {
      lbRound: 1,
      deHint: 'Perdants du 1er tour (vainqueurs)',
    });
    linkLoser(wbByRound[0][i * 2], m, 'A');
    linkLoser(wbByRound[0][i * 2 + 1], m, 'B');
    lb1.push(m);
    matches.push(m);
  }
  lbByRound.push(lb1);
  lbRound += 1;

  let lbPrev = lb1;

  for (let wr = 2; wr <= wbRounds; wr += 1) {
    const wbRound = wbByRound[wr - 1];
    const cross = [];
    for (let i = 0; i < lbPrev.length; i += 1) {
      const m = createMatch(lbRound, `Repêchage — Tour ${lbRound}`, 'loser', {
        lbRound,
        deHint: `Survivant repêchage vs perdant vainqueurs (tour ${wr})`,
      });
      linkWinner(lbPrev[i], m, 'A');
      linkLoser(wbRound[i], m, 'B');
      cross.push(m);
      matches.push(m);
    }
    lbByRound.push(cross);
    lbRound += 1;
    lbPrev = cross;

    if (lbPrev.length > 1) {
      const merge = [];
      for (let i = 0; i < lbPrev.length; i += 2) {
        const m = createMatch(lbRound, `Repêchage — Tour ${lbRound}`, 'loser', {
          lbRound,
          deHint: 'Vainqueurs du tour précédent s\'affrontent',
        });
        linkWinner(lbPrev[i], m, 'A');
        linkWinner(lbPrev[i + 1], m, 'B');
        merge.push(m);
        matches.push(m);
      }
      lbByRound.push(merge);
      lbRound += 1;
      lbPrev = merge;
    }
  }

  const wbFinal = wbByRound[wbByRound.length - 1][0];
  const lbChampMatch = lbPrev[0];
  const grandFinal = createMatch(99, 'Grande finale', 'final', {
    deHint: 'Vainqueur du bracket vainqueurs vs vainqueur du repêchage',
  });
  matches.push(grandFinal);
  linkWinner(wbFinal, grandFinal, 'A');
  linkWinner(lbChampMatch, grandFinal, 'B');

  return {
    matches,
    wbByRound,
    lbByRound,
    phase: 'bracket',
    deVersion: 3,
  };
}

/** Regroupe les matchs par bracket puis par tour. */
export function getDoubleElimRounds(tournament) {
  const wb = new Map();
  const lb = new Map();

  for (const m of tournament.state.matches) {
    if (m.bracket === 'winner') {
      const key = m.wbRound ?? m.round;
      if (!wb.has(key)) wb.set(key, { label: m.roundName, matches: [], hint: null });
      wb.get(key).matches.push(m);
    }
    if (m.bracket === 'loser') {
      const key = m.lbRound ?? m.round;
      if (!lb.has(key)) {
        lb.set(key, { label: m.roundName, matches: [], hint: m.deHint || null });
      }
      lb.get(key).matches.push(m);
    }
  }

  const sortKeys = (map) =>
    [...map.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([, v]) => v);

  const grandFinal = tournament.state.matches.find((m) => m.bracket === 'final');

  return { wbRounds: sortKeys(wb), lbRounds: sortKeys(lb), grandFinal };
}

/** Reconstruit les liens WB/LB pour les tournois existants (v1/v2). */
export function rebuildDoubleElimLinks(tournament) {
  if (tournament.format !== FORMATS.DOUBLE_ELIMINATION) return;

  const wbMatches = tournament.state.matches
    .filter((m) => m.bracket === 'winner')
    .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
  const lbMatches = tournament.state.matches
    .filter((m) => m.bracket === 'loser')
    .sort((a, b) => (a.lbRound ?? a.round) - (b.lbRound ?? b.round) || a.id.localeCompare(b.id));
  const grandFinal = tournament.state.matches.find((m) => m.bracket === 'final');

  const wbRoundKeys = [...new Set(wbMatches.map((m) => m.round))].sort((a, b) => a - b);
  const wbByRound = wbRoundKeys.map((key) => wbMatches.filter((m) => m.round === key));

  const lbRoundKeys = [...new Set(lbMatches.map((m) => m.lbRound ?? m.round))].sort(
    (a, b) => a - b
  );
  const lbByRound = lbRoundKeys.map((key) =>
    lbMatches.filter((m) => (m.lbRound ?? m.round) === key)
  );

  for (const m of [...wbMatches, ...lbMatches, grandFinal].filter(Boolean)) {
    m.nextMatchId = null;
    m.nextSlot = null;
    m.loserNextMatchId = null;
    m.loserNextSlot = null;
  }

  for (let ri = 0; ri < wbByRound.length - 1; ri += 1) {
    const current = wbByRound[ri];
    const next = wbByRound[ri + 1];
    for (let i = 0; i < current.length; i += 2) {
      linkWinner(current[i], next[Math.floor(i / 2)], 'A');
      linkWinner(current[i + 1], next[Math.floor(i / 2)], 'B');
    }
  }

  if (lbByRound[0] && wbByRound[0]) {
    for (let i = 0; i < lbByRound[0].length; i += 1) {
      linkLoser(wbByRound[0][i * 2], lbByRound[0][i], 'A');
      linkLoser(wbByRound[0][i * 2 + 1], lbByRound[0][i], 'B');
    }
  }

  let lbRoundIndex = 1;
  let lbPrevRound = lbByRound[0];

  for (let wri = 1; wri < wbByRound.length; wri += 1) {
    const cross = lbByRound[lbRoundIndex];
    if (!cross || !lbPrevRound) break;

    for (let i = 0; i < cross.length; i += 1) {
      linkWinner(lbPrevRound[i], cross[i], 'A');
      if (wbByRound[wri][i]) linkLoser(wbByRound[wri][i], cross[i], 'B');
    }

    lbRoundIndex += 1;
    lbPrevRound = cross;

    if (lbPrevRound.length > 1 && lbRoundIndex < lbByRound.length) {
      const merge = lbByRound[lbRoundIndex];
      if (merge.length < lbPrevRound.length) {
        for (let i = 0; i < merge.length; i += 1) {
          linkWinner(lbPrevRound[i * 2], merge[i], 'A');
          linkWinner(lbPrevRound[i * 2 + 1], merge[i], 'B');
        }
        lbRoundIndex += 1;
        lbPrevRound = merge;
      }
    }
  }

  if (grandFinal && wbByRound.length) {
    linkWinner(wbByRound[wbByRound.length - 1][0], grandFinal, 'A');
  }
  if (grandFinal && lbByRound.length) {
    linkWinner(lbByRound[lbByRound.length - 1][0], grandFinal, 'B');
  }

  const wbNames = getRoundNames(wbByRound.length);
  wbByRound.forEach((round, i) => {
    round.forEach((m) => {
      m.wbRound = i + 1;
      m.roundName = `Vainqueurs — ${wbNames[i]}`;
    });
  });

  lbByRound.forEach((round, i) => {
    const hints = [
      'Perdants du 1er tour (vainqueurs)',
      null,
      null,
      null,
    ];
    round.forEach((m) => {
      m.lbRound = i + 1;
      m.round = i + 1;
      m.roundName = `Repêchage — Tour ${i + 1}`;
      if (!m.deHint) m.deHint = hints[i] || 'Survivants du repêchage';
    });
  });

  if (grandFinal) {
    grandFinal.deHint = 'Vainqueur du bracket vainqueurs vs vainqueur du repêchage';
  }

  tournament.state.deVersion = 3;
  delete tournament.state.loserBracketVersion;
}

/** Réapplique vainqueurs/perdants depuis les matchs terminés. */
export function syncDoubleElimParticipants(tournament) {
  if (tournament.format !== FORMATS.DOUBLE_ELIMINATION) return;

  if ((tournament.state.deVersion ?? tournament.state.loserBracketVersion ?? 0) < 3) {
    rebuildDoubleElimLinks(tournament);
  }

  for (const m of tournament.state.matches) {
    if (m.bracket === 'winner' && m.round === 1) continue;
    if (m.bracket === 'final') {
      m.participantAId = null;
      m.participantBId = null;
      continue;
    }
    m.participantAId = null;
    m.participantBId = null;
  }

  const completed = tournament.state.matches
    .filter((m) => m.status === 'completed' && m.winnerId)
    .sort((a, b) => {
      const order = { winner: 0, loser: 1, final: 2 };
      const ba = order[a.bracket] ?? 0;
      const bb = order[b.bracket] ?? 0;
      if (ba !== bb) return ba - bb;
      const ra = a.wbRound ?? a.lbRound ?? a.round;
      const rb = b.wbRound ?? b.lbRound ?? b.round;
      return ra - rb;
    });

  for (const m of completed) {
    if (m.nextMatchId) {
      const next = tournament.state.matches.find((x) => x.id === m.nextMatchId);
      if (next) {
        if (m.nextSlot === 'A') next.participantAId = m.winnerId;
        else next.participantBId = m.winnerId;
      }
    }
    if (m.loserNextMatchId) {
      const loserId = m.winnerId === m.participantAId ? m.participantBId : m.participantAId;
      const next = tournament.state.matches.find((x) => x.id === m.loserNextMatchId);
      if (next && loserId) {
        if (m.loserNextSlot === 'A') next.participantAId = loserId;
        else next.participantBId = loserId;
      }
    }
  }
}
