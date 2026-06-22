import { FORMATS, STATUS } from './types.js';
import { computeStandings } from './standings.js';
import { findMatch, generateId, nowIso, participantById } from './utils.js';
import {
  generateDoubleElimination,
  generateGroupStage,
  generateKnockoutFromGroups,
  generateRoundRobin,
  generateSingleElimination,
  generateSwissRound,
} from './generators.js';

function clearMatchResult(match) {
  match.scoreA = null;
  match.scoreB = null;
  match.winnerId = null;
  match.status = 'pending';
}

function propagateWinner(tournament, match) {
  if (!match.winnerId) return;

  if (match.nextMatchId) {
    const next = findMatch(tournament, match.nextMatchId);
    if (next) {
      if (match.nextSlot === 'A') next.participantAId = match.winnerId;
      else next.participantBId = match.winnerId;
    }
  }

  if (match.loserNextMatchId) {
    const loserId =
      match.winnerId === match.participantAId ? match.participantBId : match.participantAId;
    const next = findMatch(tournament, match.loserNextMatchId);
    if (next && loserId) {
      if (match.loserNextSlot === 'A') next.participantAId = loserId;
      else next.participantBId = loserId;
    }
  }
}

function clearDownstream(tournament, matchId, visited = new Set()) {
  if (visited.has(matchId)) return;
  visited.add(matchId);

  const match = findMatch(tournament, matchId);
  if (!match) return;

  if (match.nextMatchId) {
    const next = findMatch(tournament, match.nextMatchId);
    if (next) {
      if (match.nextSlot === 'A') next.participantAId = null;
      else next.participantBId = null;
      clearMatchResult(next);
      clearDownstream(tournament, next.id, visited);
    }
  }

  if (match.loserNextMatchId) {
    const next = findMatch(tournament, match.loserNextMatchId);
    if (next) {
      if (match.loserNextSlot === 'A') next.participantAId = null;
      else next.participantBId = null;
      clearMatchResult(next);
      clearDownstream(tournament, next.id, visited);
    }
  }
}

function determineWinner(match, scoreA, scoreB, drawWinnerId = null) {
  if (scoreA === scoreB) {
    return drawWinnerId || match.participantAId;
  }
  return scoreA > scoreB ? match.participantAId : match.participantBId;
}

export function createTournament(payload) {
  const {
    name,
    format,
    participantCount,
    participants,
    seedMode = 'random',
    groupCount = 2,
    qualifiersPerGroup = 2,
    swissRounds = 3,
  } = payload;

  const tournament = {
    id: generateId('t'),
    name: name.trim(),
    format,
    status: STATUS.DRAFT,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    settings: {
      participantCount,
      seedMode,
      groupCount,
      qualifiersPerGroup,
      swissRounds,
      swissCurrentRound: 0,
    },
    participants,
    state: { matches: [], phase: 'setup' },
  };

  return generateBracket(tournament);
}

export function generateBracket(tournament) {
  const active = tournament.participants.filter((p) => !p.forfeited && !p.isBye);

  switch (tournament.format) {
    case FORMATS.SINGLE_ELIMINATION: {
      const result = generateSingleElimination(active, tournament.settings.seedMode);
      tournament.state = { ...result };
      break;
    }
    case FORMATS.DOUBLE_ELIMINATION: {
      const result = generateDoubleElimination(active, tournament.settings.seedMode);
      tournament.state = { ...result };
      break;
    }
    case FORMATS.ROUND_ROBIN: {
      const result = generateRoundRobin(active);
      tournament.state = { ...result };
      break;
    }
    case FORMATS.GROUP_STAGE: {
      const result = generateGroupStage(
        active,
        tournament.settings.groupCount,
        tournament.settings.seedMode
      );
      tournament.state = {
        ...result,
        standingsByGroup: {},
        knockout: null,
        knockoutGenerated: false,
      };
      break;
    }
    case FORMATS.SWISS: {
      const round1 = generateSwissRound(tournament, 1);
      tournament.state = {
        matches: round1,
        phase: 'swiss',
        currentRound: 1,
      };
      tournament.settings.swissCurrentRound = 1;
      break;
    }
    default:
      throw new Error('Format de tournoi inconnu.');
  }

  tournament.status = STATUS.IN_PROGRESS;
  tournament.updatedAt = nowIso();
  refreshDerivedState(tournament);
  return tournament;
}

function replayCompletedMatches(tournament) {
  const completed = [...tournament.state.matches]
    .filter((m) => m.status === 'completed' && m.winnerId)
    .sort((a, b) => {
      const bracketOrder = { winner: 0, loser: 1, final: 2 };
      const ba = bracketOrder[a.bracket] ?? 0;
      const bb = bracketOrder[b.bracket] ?? 0;
      if (a.round !== b.round) return a.round - b.round;
      return ba - bb;
    });

  for (const m of completed) {
    propagateWinner(tournament, m);
  }
}

/** Répare les liens LB Tour 2 des tournois créés avec l'ancien algorithme. */
function repairDoubleEliminationLosers(tournament) {
  if (tournament.format !== FORMATS.DOUBLE_ELIMINATION) return;
  if (tournament.state.loserBracketVersion >= 2) return;

  const lbByRound = new Map();
  const wbByRound = new Map();

  for (const m of tournament.state.matches) {
    if (m.bracket === 'loser') {
      if (!lbByRound.has(m.round)) lbByRound.set(m.round, []);
      lbByRound.get(m.round).push(m);
    }
    if (m.bracket === 'winner') {
      if (!wbByRound.has(m.round)) wbByRound.set(m.round, []);
      wbByRound.get(m.round).push(m);
    }
  }

  const lb1 = lbByRound.get(1) || [];
  const lb2 = lbByRound.get(2) || [];
  const wb2 = wbByRound.get(2) || [];

  if (lb1.length > 0 && lb2.length === lb1.length) {
    lb2.forEach((m, i) => {
      if (lb1[i]) {
        lb1[i].nextMatchId = m.id;
        lb1[i].nextSlot = 'A';
        if (lb1[i + 1] && lb1[i + 1].nextMatchId === m.id) {
          lb1[i + 1].nextMatchId = null;
          lb1[i + 1].nextSlot = null;
        }
      }
      if (wb2[i]) {
        wb2[i].loserNextMatchId = m.id;
        wb2[i].loserNextSlot = 'B';
      }
    });
  }

  tournament.state.loserBracketVersion = 2;
  replayCompletedMatches(tournament);
}

function resolveByeMatches(tournament) {
  for (const match of tournament.state.matches) {
    if (match.status === 'completed') continue;
    const pA = participantById(tournament, match.participantAId);
    const pB = participantById(tournament, match.participantBId);
    if (pA?.isBye && pB && !pB.isBye) {
      match.scoreA = 0;
      match.scoreB = 1;
      match.winnerId = match.participantBId;
      match.status = 'completed';
      propagateWinner(tournament, match);
    } else if (pB?.isBye && pA && !pA.isBye) {
      match.scoreA = 1;
      match.scoreB = 0;
      match.winnerId = match.participantAId;
      match.status = 'completed';
      propagateWinner(tournament, match);
    }
  }
}

export function refreshDerivedState(tournament) {
  if (tournament.format === FORMATS.ROUND_ROBIN) {
    tournament.state.standings = computeStandings(tournament);
  }

  if (tournament.format === FORMATS.GROUP_STAGE && tournament.state.groups) {
    tournament.state.standingsByGroup = {};
    for (const group of tournament.state.groups) {
      tournament.state.standingsByGroup[group.id] = computeStandings(tournament, {
        groupId: group.id,
      });
    }

    const groupDone = tournament.state.matches
      .filter((m) => m.groupId)
      .every((m) => m.status === 'completed' || m.status === 'bye');

    if (
      groupDone &&
      !tournament.state.knockoutGenerated &&
      tournament.state.phase === 'groups'
    ) {
      const knockout = generateKnockoutFromGroups(
        tournament,
        tournament.settings.qualifiersPerGroup
      );
      if (knockout) {
        tournament.state.knockout = knockout;
        tournament.state.knockoutGenerated = true;
        tournament.state.phase = 'knockout';
        tournament.state.matches = [...tournament.state.matches, ...knockout.matches];
      }
    }
  }

  if (tournament.format === FORMATS.SWISS) {
    tournament.state.standings = computeStandings(tournament);
  }

  if (
    tournament.format === FORMATS.SINGLE_ELIMINATION ||
    tournament.format === FORMATS.DOUBLE_ELIMINATION ||
    tournament.format === FORMATS.GROUP_STAGE
  ) {
    const finalMatch = [...tournament.state.matches]
      .reverse()
      .find(
        (m) =>
          m.bracket === 'final' ||
          m.roundName === 'Finale' ||
          m.roundName === 'Grande finale'
      );
    if (finalMatch?.status === 'completed') {
      tournament.status = STATUS.COMPLETED;
    }
  }

  if (tournament.format === FORMATS.ROUND_ROBIN) {
    const allDone = tournament.state.matches.every(
      (m) => m.status === 'completed' || m.status === 'bye'
    );
    if (allDone && tournament.state.matches.length) {
      tournament.status = STATUS.COMPLETED;
    }
  }

  tournament.updatedAt = nowIso();
  repairDoubleEliminationLosers(tournament);
  resolveByeMatches(tournament);
  replayCompletedMatches(tournament);
  return tournament;
}

export function validateMatchResult(tournament, matchId, scoreA, scoreB, drawWinnerId = null) {
  const match = findMatch(tournament, matchId);
  if (!match) throw new Error('Match introuvable.');
  if (match.status === 'bye') throw new Error('Ce match est un bye.');
  if (!match.participantAId || !match.participantBId) {
    throw new Error('Les deux participants doivent être définis.');
  }
  if (scoreA < 0 || scoreB < 0) throw new Error('Scores invalides.');
  if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) throw new Error('Scores invalides.');

  clearDownstream(tournament, matchId);

  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.winnerId = determineWinner(match, scoreA, scoreB, drawWinnerId);
  match.status = 'completed';

  propagateWinner(tournament, match);
  refreshDerivedState(tournament);
  return tournament;
}

export function editMatchResult(tournament, matchId, scoreA, scoreB, drawWinnerId = null) {
  return validateMatchResult(tournament, matchId, scoreA, scoreB, drawWinnerId);
}

export function declareForfeit(tournament, participantId) {
  const participant = tournament.participants.find((p) => p.id === participantId);
  if (!participant) throw new Error('Participant introuvable.');
  participant.forfeited = true;

  for (const match of tournament.state.matches) {
    if (match.status === 'completed') continue;
    if (match.participantAId === participantId || match.participantBId === participantId) {
      const opponentId =
        match.participantAId === participantId ? match.participantBId : match.participantAId;
      if (opponentId) {
        const scoreA = match.participantAId === opponentId ? 1 : 0;
        const scoreB = match.participantBId === opponentId ? 1 : 0;
        validateMatchResult(tournament, match.id, scoreA, scoreB);
      }
    }
  }

  refreshDerivedState(tournament);
  return tournament;
}

export function renameParticipant(tournament, participantId, newName) {
  const participant = tournament.participants.find((p) => p.id === participantId);
  if (!participant) throw new Error('Participant introuvable.');
  participant.name = newName.trim();
  tournament.updatedAt = nowIso();
  refreshDerivedState(tournament);
  return tournament;
}

export function addParticipant(tournament, participant) {
  if (tournament.status !== STATUS.DRAFT) {
    throw new Error('Impossible d\'ajouter un participant après le début du tournoi.');
  }
  tournament.participants.push(participant);
  tournament.settings.participantCount = tournament.participants.length;
  tournament.updatedAt = nowIso();
  return tournament;
}

export function generateNextSwissRound(tournament) {
  if (tournament.format !== FORMATS.SWISS) {
    throw new Error('Ce tournoi n\'est pas au format suisse.');
  }

  const currentRound = tournament.settings.swissCurrentRound || 1;
  const roundMatches = tournament.state.matches.filter((m) => m.swissRound === currentRound);
  const allDone = roundMatches.every((m) => m.status === 'completed' || m.status === 'bye');
  if (!allDone) throw new Error('Terminez tous les matchs de la ronde en cours.');

  if (currentRound >= tournament.settings.swissRounds) {
    tournament.status = STATUS.COMPLETED;
    refreshDerivedState(tournament);
    return tournament;
  }

  const nextRound = currentRound + 1;
  const newMatches = generateSwissRound(tournament, nextRound);
  tournament.state.matches.push(...newMatches);
  tournament.state.currentRound = nextRound;
  tournament.settings.swissCurrentRound = nextRound;
  refreshDerivedState(tournament);
  return tournament;
}

export function duplicateTournament(source) {
  const copy = JSON.parse(JSON.stringify(source));
  copy.id = generateId('t');
  copy.name = `${source.name} (copie)`;
  copy.status = STATUS.DRAFT;
  copy.createdAt = nowIso();
  copy.updatedAt = nowIso();
  copy.state = { matches: [], phase: 'setup' };
  return copy;
}

export function swissCanAdvance(tournament) {
  if (tournament.format !== FORMATS.SWISS) return false;
  const currentRound = tournament.settings.swissCurrentRound || 1;
  const roundMatches = tournament.state.matches.filter((m) => m.swissRound === currentRound);
  if (!roundMatches.length) return false;
  return roundMatches.every((m) => m.status === 'completed' || m.status === 'bye');
}

export function hasStarted(tournament) {
  return tournament.state.matches.some((m) => m.status === 'completed');
}
