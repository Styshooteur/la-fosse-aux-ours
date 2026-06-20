export const ELO_K = 30;

export function expectedScore(eloSelf, eloOpponent) {
  return 1 / (1 + 10 ** ((eloOpponent - eloSelf) / 400));
}

export function winrateModifier(victoires, matchsJoues) {
  if (matchsJoues < 10) return 1;
  const winrate = victoires / matchsJoues;
  return 0.6 + 0.8 * winrate;
}

function parsePositiveInt(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${label} doit être un entier positif.`);
  }
  return n;
}

export function validateFighterInput({ elo, victoires, matchsJoues }, label) {
  const eloVal = parsePositiveInt(elo, `L'Elo de ${label}`);
  if (eloVal <= 0) {
    throw new Error(`L'Elo de ${label} doit être un entier strictement positif.`);
  }

  const victoiresVal = parsePositiveInt(victoires, `Les victoires de ${label}`);
  const matchsVal = parsePositiveInt(matchsJoues, `Les matchs joués de ${label}`);

  if (victoiresVal > matchsVal) {
    throw new Error(`${label} : les victoires ne peuvent pas dépasser les matchs joués.`);
  }

  return { elo: eloVal, victoires: victoiresVal, matchsJoues: matchsVal };
}

export function calculateEloMatch({ fighterA, fighterB, winner }) {
  if (winner !== 'A' && winner !== 'B') {
    throw new Error('Sélectionnez le vainqueur du combat avant de calculer.');
  }

  const a = validateFighterInput(fighterA, 'Combattant A');
  const b = validateFighterInput(fighterB, 'Combattant B');

  const expectedA = expectedScore(a.elo, b.elo);
  const expectedB = 1 - expectedA;

  const scoreA = winner === 'A' ? 1 : 0;
  const scoreB = 1 - scoreA;

  const modA = winrateModifier(a.victoires, a.matchsJoues);
  const modB = winrateModifier(b.victoires, b.matchsJoues);

  const deltaA = Math.round(ELO_K * (scoreA - expectedA) * modA);
  const deltaB = Math.round(ELO_K * (scoreB - expectedB) * modB);

  return {
    fighterA: {
      ...a,
      expected: expectedA,
      modifier: modA,
      winrate: a.matchsJoues >= 10 ? a.victoires / a.matchsJoues : null,
      delta: deltaA,
      newElo: a.elo + deltaA,
      won: winner === 'A',
    },
    fighterB: {
      ...b,
      expected: expectedB,
      modifier: modB,
      winrate: b.matchsJoues >= 10 ? b.victoires / b.matchsJoues : null,
      delta: deltaB,
      newElo: b.elo + deltaB,
      won: winner === 'B',
    },
  };
}

export function formatPercent(ratio) {
  return `${(ratio * 100).toFixed(1)} %`;
}

export function formatModifier(value) {
  return `×${value.toFixed(2)}`;
}

export function formatDelta(delta) {
  return delta >= 0 ? `+${delta} pts` : `${delta} pts`;
}
