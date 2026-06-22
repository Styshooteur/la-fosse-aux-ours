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

export { generateDoubleElimination } from './double-elim.js';

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
    const standings = computeStandings(tournament, { groupId: group.id });
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
    const bye = {
      id: generateId('bye'),
      name: 'BYE (exempt)',
      color: '#cccccc',
      forfeited: false,
      isBye: true,
    };
    padded.push(bye);
    tournament.participants.push(bye);
  }

  const bracket = generateSingleElimination(padded.slice(0, size), 'manual');
  bracket.matches.forEach((m) => {
    m.knockout = true;
  });

  return {
    matches: bracket.matches,
    phase: 'knockout',
    knockoutGenerated: true,
  };
}

function swissPairKey(a, b) {
  return [a, b].sort().join('|');
}

function swissCanPair(a, b, playedPairs, allowRematch) {
  return allowRematch || !playedPairs.has(swissPairKey(a, b));
}

/** Appariement par backtracking dans un groupe (ordre = classement). */
function swissPairGroup(ids, playedPairs, allowRematch = false) {
  if (ids.length === 0) return [];
  if (ids.length === 1) return null;

  const [first, ...rest] = ids;
  for (let i = 0; i < rest.length; i += 1) {
    const opponent = rest[i];
    if (!swissCanPair(first, opponent, playedPairs, allowRematch)) continue;

    const remaining = [...rest.slice(0, i), ...rest.slice(i + 1)];
    const sub = swissPairGroup(remaining, playedPairs, allowRematch);
    if (sub !== null) {
      return [[first, opponent], ...sub];
    }
  }
  return null;
}

/** Regroupe les joueurs par score en conservant l'ordre du classement. */
function swissScoreGroups(standingsList) {
  const groups = [];
  let current = [];
  let currentPts = null;

  for (const row of standingsList) {
    if (currentPts !== null && row.pts !== currentPts) {
      groups.push(current);
      current = [];
    }
    currentPts = row.pts;
    current.push(row.participantId);
  }
  if (current.length) groups.push(current);
  return groups;
}

/**
 * Appariement suisse : groupes par score → paires sans rematch dans le groupe
 * → flottement vers le groupe inférieur si impair → rematch en dernier recours.
 */
function swissPairByScoreGroups(standingsList, playedPairs) {
  const scoreGroups = swissScoreGroups(standingsList);
  const matches = [];
  let floated = null;

  for (let gi = 0; gi < scoreGroups.length; gi += 1) {
    let ids = floated ? [floated, ...scoreGroups[gi]] : [...scoreGroups[gi]];
    floated = null;

    if (ids.length % 2 === 1) {
      floated = ids.pop();
    }

    if (ids.length === 0) continue;

    let pairs = swissPairGroup(ids, playedPairs, false);

    if (!pairs && gi < scoreGroups.length - 1 && ids.length >= 2) {
      const down = ids.pop();
      pairs = swissPairGroup(ids, playedPairs, false);
      if (pairs) {
        scoreGroups[gi + 1] = [down, ...scoreGroups[gi + 1]];
      } else {
        ids.push(down);
      }
    }

    if (!pairs) {
      pairs = swissPairGroup(ids, playedPairs, true);
    }

    if (!pairs) {
      throw new Error('Impossible de générer les appariements pour cette ronde.');
    }

    matches.push(...pairs);
  }

  if (floated) {
    throw new Error('Nombre impair de participants actifs pour le système suisse.');
  }

  return matches;
}

export function generateSwissRound(tournament, roundNumber) {
  const participants = tournament.participants.filter((p) => !p.forfeited);
  const allPrevious = tournament.state.matches.filter((m) => m.status === 'completed');

  const playedPairs = new Set(
    tournament.state.matches
      .filter((m) => m.participantAId && m.participantBId)
      .map((m) => swissPairKey(m.participantAId, m.participantBId))
  );

  let pairings;

  if (roundNumber === 1) {
    const pool = shuffle(participants.map((p) => p.id));
    pairings = [];
    for (let i = 0; i < pool.length; i += 2) {
      if (pool[i + 1]) pairings.push([pool[i], pool[i + 1]]);
    }
  } else {
    const fake = { participants: tournament.participants, state: { matches: allPrevious } };
    const standingsList = computeStandings(fake);
    pairings = swissPairByScoreGroups(standingsList, playedPairs);
  }

  return pairings.map(([participantAId, participantBId]) =>
    createEmptyMatch(roundNumber, `Ronde ${roundNumber}`, null, {
      swissRound: roundNumber,
      participantAId,
      participantBId,
    })
  );
}
