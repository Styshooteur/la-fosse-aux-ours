/**
 * Métriques de layout pour les arbres d'élimination.
 * Basées sur le nombre réel de matchs par round — pas de compression artificielle.
 */
export function computeBracketLayoutMetrics(rounds) {
  const firstCount = Math.max(1, rounds[0]?.length || 1);
  const roundCount = Math.max(1, rounds.length);

  const cardH = 132;
  const rowGap = Math.max(28, Math.min(44, Math.round(200 / Math.sqrt(firstCount))));
  const slotPitch = cardH + rowGap;
  const colW = 384;
  const roundHeaderH = 42;
  const treePadBottom = 24;
  const connInset = 16;

  return {
    cardH,
    rowGap,
    slotPitch,
    colW,
    roundHeaderH,
    treePadBottom,
    connInset,
    firstCount,
    roundCount,
  };
}

export function layoutBracketPositions(rounds, linkField, metrics) {
  const { slotPitch, cardH, rowGap } = metrics;
  const pos = new Map();

  rounds.forEach((roundMatches, colIndex) => {
    if (colIndex === 0) {
      roundMatches.forEach((m, i) => pos.set(m.id, i * slotPitch));
      return;
    }

    const prevRound = rounds[colIndex - 1];
    roundMatches.forEach((m) => {
      const feeders = prevRound.filter((pm) => pm[linkField] === m.id);
      if (feeders.length >= 2) {
        const centers = feeders.map((f) => pos.get(f.id) + cardH / 2);
        const avg = centers.reduce((s, c) => s + c, 0) / feeders.length;
        pos.set(m.id, avg - cardH / 2);
      } else if (feeders.length === 1) {
        pos.set(m.id, pos.get(feeders[0].id));
      } else {
        const placed = roundMatches.filter((rm) => pos.has(rm.id) && rm.id !== m.id);
        const y = placed.length
          ? Math.max(...placed.map((rm) => pos.get(rm.id))) + slotPitch
          : 0;
        pos.set(m.id, y);
      }
    });

    const sorted = [...roundMatches].sort((a, b) => pos.get(a.id) - pos.get(b.id));
    for (let i = 1; i < sorted.length; i++) {
      const minY = pos.get(sorted[i - 1].id) + cardH + rowGap;
      if (pos.get(sorted[i].id) < minY) pos.set(sorted[i].id, minY);
    }
  });

  return pos;
}

export function columnBodyHeight(roundMatches, positions, metrics) {
  if (!roundMatches.length) return metrics.cardH + metrics.treePadBottom;
  const maxBottom = Math.max(...roundMatches.map((m) => positions.get(m.id) + metrics.cardH));
  return maxBottom + metrics.treePadBottom;
}

export function matchCenterY(top, metrics) {
  return metrics.roundHeaderH + top + metrics.cardH / 2;
}

export function connectorPath(colIndex, topFrom, topTo, metrics) {
  const { colW, connInset, roundHeaderH, cardH } = metrics;
  const y1 = roundHeaderH + topFrom + cardH / 2;
  const y2 = roundHeaderH + topTo + cardH / 2;
  const x1 = colIndex * colW + colW - connInset;
  const x2 = (colIndex + 1) * colW + connInset;
  const midX = (x1 + x2) / 2;
  return `M${x1} ${y1} H${midX} V${y2} H${x2}`;
}

/** Détecte les chevauchements verticaux dans une colonne (audit). */
export function detectColumnOverlaps(roundMatches, positions, metrics) {
  const overlaps = [];
  const sorted = [...roundMatches].sort((a, b) => positions.get(a.id) - positions.get(b.id));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = positions.get(curr.id) - (positions.get(prev.id) + metrics.cardH);
    if (gap < metrics.rowGap - 1) {
      overlaps.push({ prev: prev.id, curr: curr.id, gap });
    }
  }
  return overlaps;
}
