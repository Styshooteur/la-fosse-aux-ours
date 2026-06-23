/**
 * Audit layout bracket — vérifie centrage récursif et absence de chevauchement.
 * Usage: node scripts/audit-bracket-layout.mjs
 */
import { generateSingleElimination } from '../js/tournaments/generators.js';
import { generateDoubleElimination } from '../js/tournaments/double-elim.js';
import { generateRoundRobin } from '../js/tournaments/generators.js';
import { generateGroupStage } from '../js/tournaments/generators.js';
import { generateSwissRound } from '../js/tournaments/generators.js';
import {
  computeBracketLayoutMetrics,
  layoutBracketCenters,
  centersToTops,
  detectCenteringViolations,
  detectColumnOverlaps,
} from '../js/tournaments/bracket-layout.js';

const SIZES = [4, 8, 16, 32];

function makeParticipants(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Joueur${i + 1}`,
    color: '#8f6118',
    isBye: false,
  }));
}

function auditTree(label, matches, getRoundKey, sortWithinRound = null) {
  const bracketIndex = new Map(matches.map((m, i) => [m.id, i]));
  const roundKeys = [...new Set(matches.map(getRoundKey))].sort((a, b) => a - b);
  const rounds = roundKeys.map((k) =>
    matches
      .filter((m) => getRoundKey(m) === k)
      .sort((a, b) => {
        if (sortWithinRound) return sortWithinRound(a, b);
        return bracketIndex.get(a.id) - bracketIndex.get(b.id);
      })
  );
  const metrics = computeBracketLayoutMetrics(rounds);
  const centers = layoutBracketCenters(rounds, 'nextMatchId', metrics);
  const tops = centersToTops(centers, metrics.cardH);

  let issues = 0;

  const centerViolations = detectCenteringViolations(rounds, 'nextMatchId', centers);
  if (centerViolations.length) {
    console.error(`  ✗ ${label}: ${centerViolations.length} violation(s) de centrage récursif`);
    issues += centerViolations.length;
  }

  rounds.forEach((rm, col) => {
    const overlaps = detectColumnOverlaps(rm, tops, metrics);
    if (overlaps.length) {
      console.error(`  ✗ ${label} col ${col + 1}: ${overlaps.length} chevauchement(s)`);
      issues += overlaps.length;
    }
  });

  const svgW = rounds.length * metrics.colW;
  const totalH = metrics.roundHeaderH + metrics.treeBodyHeight;
  console.log(
    `  ✓ ${label}: ${rounds.length} tours, bodyH=${metrics.treeBodyHeight}px, totalH=${totalH}px, W=${svgW}px, pitch=${metrics.slotPitch}px`
  );
  return issues;
}

let totalIssues = 0;

for (const n of SIZES) {
  const parts = makeParticipants(n);
  console.log(`\n── ${n} participants ──`);

  const se = generateSingleElimination(parts);
  totalIssues += auditTree('Single Elim', se.matches, (m) => m.round);

  const de = generateDoubleElimination(parts);
  const wb = de.matches.filter((m) => m.bracket === 'winner');
  const lb = de.matches.filter((m) => m.bracket === 'loser');
  totalIssues += auditTree('DE Winner', wb, (m) => m.wbRound ?? m.round);
  totalIssues += auditTree('DE Loser', lb, (m) => m.lbRound ?? m.round);

  const rr = generateRoundRobin(parts);
  console.log(`  ✓ Round Robin: ${rr.matches.length} matchs (liste)`);

  const gs = generateGroupStage(parts, 2, 2);
  console.log(`  ✓ Group Stage: ${gs.groups.length} groupes, ${gs.matches.length} matchs`);

  const swissTournament = { participants: parts, state: { matches: [] } };
  const r1 = generateSwissRound(swissTournament, 1);
  console.log(`  ✓ Swiss R1: ${r1.length} matchs`);
}

console.log(
  `\n${totalIssues === 0 ? '✅ Centrage récursif OK, aucun chevauchement' : `❌ ${totalIssues} problème(s)`}`
);
process.exit(totalIssues > 0 ? 1 : 0);
