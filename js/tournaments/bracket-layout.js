/**
 * Layout d'arbre d'élimination — centrage récursif depuis le Round 1.
 *
 * Règle fondamentale :
 *   centerY(match) = moyenne des centerY de ses feeders (2 sources)
 *   ou centerY(feeder) si une seule source (repêchage cross).
 *
 * Le Round 1 est la seule référence spatiale ; tous les rounds suivants
 * en découlent par propagation, sans repositionnement indépendant.
 */

/** Espacement fixe entre cartes — jamais réduit pour les grands brackets. */
const CARD_H = 176;
const ROW_GAP = 40;
const COL_W = 384;
const COL_PAD_X = 6;
const ROUND_HEADER_H = 38;
const TREE_PAD_TOP = 16;
const TREE_PAD_BOTTOM = 24;
const CONN_INSET = 12;

export function computeBracketLayoutMetrics(rounds) {
  const firstCount = Math.max(1, rounds[0]?.length || 1);
  const slotPitch = CARD_H + ROW_GAP;

  // hauteur = padding_haut + n×(carte+gap) + padding_bas
  const treeBodyHeight = TREE_PAD_TOP + firstCount * slotPitch + TREE_PAD_BOTTOM;

  return {
    cardH: CARD_H,
    rowGap: ROW_GAP,
    slotPitch,
    colW: COL_W,
    colPadX: COL_PAD_X,
    roundHeaderH: ROUND_HEADER_H,
    treePadTop: TREE_PAD_TOP,
    treePadBottom: TREE_PAD_BOTTOM,
    treeBodyHeight,
    connInset: CONN_INSET,
    firstCount,
    roundCount: Math.max(1, rounds.length),
  };
}

/**
 * Calcule le centre vertical de chaque match (coordonnée dans le corps de colonne).
 * @returns Map<matchId, centerY>
 */
export function layoutBracketCenters(rounds, linkField, metrics) {
  const { cardH, slotPitch } = metrics;
  const centerY = new Map();

  if (!rounds.length) return centerY;

  // Round 1 : espacement uniforme depuis le padding haut (référence absolue)
  rounds[0].forEach((m, i) => {
    centerY.set(m.id, metrics.treePadTop + i * slotPitch + cardH / 2);
  });

  // Rounds suivants : propagation récursive depuis les feeders
  for (let col = 1; col < rounds.length; col += 1) {
    const prevRound = rounds[col - 1];
    for (const m of rounds[col]) {
      const feeders = prevRound.filter((pm) => pm[linkField] === m.id);
      if (feeders.length >= 2) {
        const sum = feeders.reduce((s, f) => s + centerY.get(f.id), 0);
        centerY.set(m.id, sum / feeders.length);
      } else if (feeders.length === 1) {
        centerY.set(m.id, centerY.get(feeders[0].id));
      } else {
        // Arbre invalide ou match sans lien — fallback indexé (ne doit pas arriver)
        const idx = rounds[col].indexOf(m);
        centerY.set(m.id, metrics.treePadTop + idx * slotPitch + cardH / 2);
      }
    }
  }

  return centerY;
}

/** Convertit les centres en positions `top` pour le positionnement absolu. */
export function centersToTops(centerY, cardH) {
  const tops = new Map();
  for (const [id, cy] of centerY) {
    tops.set(id, cy - cardH / 2);
  }
  return tops;
}

export function layoutBracketPositions(rounds, linkField, metrics) {
  const centers = layoutBracketCenters(rounds, linkField, metrics);
  return centersToTops(centers, metrics.cardH);
}

/** Coordonnée Y du centre dans le repère SVG (inclut l'en-tête de colonne). */
export function svgCenterY(bodyCenterY, metrics) {
  return metrics.roundHeaderH + bodyCenterY;
}

export function columnCardRightX(colIndex, metrics) {
  return (colIndex + 1) * metrics.colW - metrics.colPadX - metrics.connInset;
}

export function columnCardLeftX(colIndex, metrics) {
  return (colIndex + 1) * metrics.colW + metrics.colPadX + metrics.connInset;
}

/**
 * Connecteur en ⌐ : bord droit source → point intermédiaire → bord gauche destination.
 * @param bodyCenterFrom centre vertical source dans le corps de colonne
 * @param bodyCenterTo centre vertical destination dans le corps de colonne
 */
export function connectorPathFromCenters(colIndex, bodyCenterFrom, bodyCenterTo, metrics) {
  const y1 = svgCenterY(bodyCenterFrom, metrics);
  const y2 = svgCenterY(bodyCenterTo, metrics);
  const x1 = columnCardRightX(colIndex, metrics);
  const x2 = columnCardLeftX(colIndex, metrics);
  const midX = (x1 + x2) / 2;
  return `M${x1} ${y1} H${midX} V${y2} H${x2}`;
}

/** @deprecated utiliser connectorPathFromCenters */
export function connectorPath(colIndex, topFrom, topTo, metrics) {
  return connectorPathFromCenters(
    colIndex,
    topFrom + metrics.cardH / 2,
    topTo + metrics.cardH / 2,
    metrics
  );
}

/** Vérifie la règle centerY = moyenne des feeders pour chaque match. */
export function detectCenteringViolations(rounds, linkField, centers) {
  const violations = [];
  for (let col = 1; col < rounds.length; col += 1) {
    const prevRound = rounds[col - 1];
    for (const m of rounds[col]) {
      const feeders = prevRound.filter((pm) => pm[linkField] === m.id);
      if (feeders.length < 2) continue;
      const expected =
        feeders.reduce((s, f) => s + centers.get(f.id), 0) / feeders.length;
      const actual = centers.get(m.id);
      if (Math.abs(actual - expected) > 0.5) {
        violations.push({ matchId: m.id, expected, actual, col });
      }
    }
  }
  return violations;
}

export function detectColumnOverlaps(roundMatches, tops, metrics) {
  const overlaps = [];
  const sorted = [...roundMatches].sort((a, b) => tops.get(a.id) - tops.get(b.id));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = tops.get(curr.id) - (tops.get(prev.id) + metrics.cardH);
    if (gap < -0.5) {
      overlaps.push({ prev: prev.id, curr: curr.id, gap });
    }
  }
  return overlaps;
}
