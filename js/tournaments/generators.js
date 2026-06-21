import { computeStandings } from './standings.js';
import { generateId, getRoundNames, shuffle } from './utils.js';

function createEmptyMatch(round, roundName, bracket = null, extra = {}) {
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

function linkWinner(prev, nextMatch, slot) {
  prev.nextMatchId = nextMatch.id;
  prev.nextSlot = slot;
}

function linkLoser(prev, nextMatch, slot) {
  prev.loserNextMatchId = nextMatch.id;
  prev.loserNextSlot = slot;
}

export function generateSingleElimination(participants, seedMode = 'random') {
  let ordered = [...participants];
  if (seedMode === 'random') ordered = shuffle(ordered);

  const n = ordered.length;
  const totalRounds = Math.log2(n);
  const roundNames = getRoundNames(totalRounds);
  const matches = [];
  const rounds = [];

  let prevRound = [];
  for (let i = 0; i < n / 2; i += 1) {
    const m = createEmptyMatch(1, roundNames[0], null, {
      participantAId: ordered[i * 2].id,
      participantBId: ordered[i * 2 + 1].id,
    });
    matches.push(m);
    prevRound.push(m);
  }
  rounds.push(prevRound);

  for (let r = 2; r <= totalRounds; r += 1) {
    const currentRound = [];
    for (let i = 0; i < prevRound.length / 2; i += 1) {
      const m = createEmptyMatch(r, roundNames[r - 1]);
      linkWinner(prevRound[i * 2], m, 'A');
      linkWinner(prevRound[i * 2 + 1], m, 'B');
      matches.push(m);
      currentRound.push(m);
    }
    prevRound = currentRound;
    rounds.push(currentRound);
  }

  return { matches, rounds, phase: 'bracket' };
}

export function generateDoubleElimination(participants, seedMode = 'random') {
  let ordered = [...participants];
  if (seedMode === 'random') ordered = shuffle(ordered);

  const n = ordered.length;
  const wbRounds = Math.log2(n);
  const roundNames = getRoundNames(wbRounds);
  const matches = [];

  const wbByRound = [];
  let prev = [];
  for (let i = 0; i < n / 2; i += 1) {
    const m = createEmptyMatch(1, roundNames[0], 'winner', {
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
      const m = createEmptyMatch(r, roundNames[r - 1], 'winner');
      linkWinner(prev[i * 2], m, 'A');
      linkWinner(prev[i * 2 + 1], m, 'B');
      matches.push(m);
      current.push(m);
    }
    prev = current;
    wbByRound.push(current);
  }

  const lbRoundCount = wbRounds * 2 - 2;
  const lbByRound = Array.from({ length: lbRoundCount }, () => []);

  for (let lr = 0; lr < lbRoundCount; lr += 1) {
    const count = lr === 0 ? n / 4 : Math.max(1, Math.floor(n / Math.pow(2, Math.floor(lr / 2) + 2)));
    for (let i = 0; i < count; i += 1) {
      const m = createEmptyMatch(lr + 1, `Loser — Tour ${lr + 1}`, 'loser');
      matches.push(m);
      lbByRound[lr].push(m);
    }
  }

  wbByRound[0].forEach((m, i) => {
    const target = lbByRound[0][Math.floor(i / 2)];
    if (target) linkLoser(m, target, i % 2 === 0 ? 'A' : 'B');
  });

  for (let wr = 1; wr < wbByRound.length; wr += 1) {
    wbByRound[wr].forEach((m, i) => {
      const lbRound = wr * 2 - 1;
      const target = lbByRound[lbRound]?.[Math.min(i, (lbByRound[lbRound]?.length || 1) - 1)];
      if (target) linkLoser(m, target, 'B');
    });
  }

  for (let lr = 0; lr < lbRoundCount - 1; lr += 1) {
    const current = lbByRound[lr];
    const next = lbByRound[lr + 1];
    if (!next?.length) continue;
    for (let i = 0; i < current.length; i += 2) {
      if (!current[i + 1]) continue;
      const target = next[Math.floor(i / 2)] || next[0];
      if (!target) continue;
      linkWinner(current[i], target, 'A');
      linkWinner(current[i + 1], target, 'B');
    }
  }

  const wbFinal = wbByRound[wbByRound.length - 1][0];
  const lbFinal = lbByRound[lbByRound.length - 1][0];
  const grandFinal = createEmptyMatch(wbRounds + lbRoundCount, 'Grande finale', 'final');
  matches.push(grandFinal);
  linkWinner(wbFinal, grandFinal, 'A');
  if (lbFinal) linkWinner(lbFinal, grandFinal, 'B');

  return { matches, wbByRound, lbByRound, phase: 'bracket' };
}

export function generateRoundRobin(participants) {
  const ids = participants.map((p) => p.id);
  const matches = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      matches.push(
        createEmptyMatch(1, 'Round Robin', null, {
          participantAId: ids[i],
          participantBId: ids[j],
        })
      );
    }
  }
  return { matches, phase: 'round-robin' };
}

export function generateGroupStage(participants, groupCount, seedMode = 'random') {
  let ordered = [...participants];
  if (seedMode === 'random') ordered = shuffle(ordered);

  const groups = Array.from({ length: groupCount }, (_, i) => ({
    id: `g${i + 1}`,
    name: `Groupe ${String.fromCharCode(65 + i)}`,
    participantIds: [],
  }));

  ordered.forEach((p, i) => {
    groups[i % groupCount].participantIds.push(p.id);
  });

  const matches = [];
  for (const group of groups) {
    const ids = group.participantIds;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        matches.push(
          createEmptyMatch(1, group.name, null, {
            groupId: group.id,
            participantAId: ids[i],
            participantBId: ids[j],
          })
        );
      }
    }
  }

  return { matches, groups, phase: 'groups', knockout: null };
}

export function generateKnockoutFromGroups(tournament, qualifiersPerGroup) {
  const qualifiers = [];
  for (const group of tournament.state.groups) {
    const standings = tournament.state.standingsByGroup?.[group.id] || [];
    const top = standings.slice(0, qualifiersPerGroup).map((s) => s.participantId);
    qualifiers.push(...top);
  }

  const participantObjs = qualifiers
    .map((id) => tournament.participants.find((p) => p.id === id))
    .filter(Boolean);

  if (participantObjs.length < 2) return null;

  const n = participantObjs.length;
  const size = [4, 8, 16, 32].find((s) => s >= n) || 4;
  const padded = [...participantObjs];
  while (padded.length < size) {
    padded.push({
      id: generateId('bye'),
      name: 'BYE',
      color: '#cccccc',
      forfeited: false,
      isBye: true,
    });
  }

  const bracket = generateSingleElimination(padded.slice(0, size), 'manual');
  return {
    matches: bracket.matches,
    phase: 'knockout',
    knockoutGenerated: true,
  };
}

export function generateSwissRound(tournament, roundNumber) {
  const participants = tournament.participants.filter((p) => !p.forfeited);
  const previousMatches = tournament.state.matches.filter((m) => m.swissRound && m.swissRound < roundNumber);
  const allPrevious = tournament.state.matches.filter((m) => m.status === 'completed');

  const playedPairs = new Set(
    tournament.state.matches
      .filter((m) => m.participantAId && m.participantBId)
      .map((m) => [m.participantAId, m.participantBId].sort().join('|'))
  );

  let pool;
  if (roundNumber === 1) {
    pool = shuffle(participants.map((p) => p.id));
  } else {
    const fake = { participants: tournament.participants, state: { matches: allPrevious } };
    pool = computeStandings(fake).map((s) => s.participantId);
  }

  const matches = [];
  const used = new Set();

  for (const id of pool) {
    if (used.has(id)) continue;
    let opponent = null;
    for (const candidate of pool) {
      if (candidate === id || used.has(candidate)) continue;
      const key = [id, candidate].sort().join('|');
      if (!playedPairs.has(key)) {
        opponent = candidate;
        break;
      }
    }
    if (!opponent) {
      opponent = pool.find((c) => c !== id && !used.has(c)) || null;
    }
    if (!opponent) continue;
    used.add(id);
    used.add(opponent);
    matches.push(
      createEmptyMatch(roundNumber, `Ronde ${roundNumber}`, null, {
        swissRound: roundNumber,
        participantAId: id,
        participantBId: opponent,
      })
    );
  }

  return matches;
}
