import { escapeHtml, renderBracketTree, renderMatchCard } from './render.js';
import { computeDoubleElimPlayOrder } from './double-elim.js';

function renderLegend() {
  return `
    <div class="t-de-legend" role="note" aria-label="Légende du bracket">
      <h3 class="t-de-legend-title">Légende</h3>
      <div class="t-de-legend-states">
        <span class="t-de-legend-chip t-match t-match--waiting t-match--compact">
          <span class="t-match-state">En attente</span>
          <span class="t-de-legend-chip-label">Participants inconnus</span>
        </span>
        <span class="t-de-legend-chip t-match t-match--playable t-match--compact">
          <span class="t-match-state">Jouable</span>
          <span class="t-de-legend-chip-label">Prêt à scorer</span>
        </span>
        <span class="t-de-legend-chip t-match t-match--done t-match--compact">
          <span class="t-match-state">Terminé</span>
          <span class="t-de-legend-chip-label">Résultat validé</span>
        </span>
      </div>
      <p class="t-de-legend-flow">
        <strong>M#</strong> = ordre de jeu recommandé ·
        <strong>Vainqueurs</strong> : une défaite envoie au repêchage ·
        <strong>Repêchage</strong> : deux défaites éliminent ·
        <strong>Grande finale</strong> en dernier (M max)
      </p>
    </div>`;
}

function renderGrandFinal(tournament, grandFinal, playOrder, readonly) {
  const order = playOrder.get(grandFinal.id);
  return `
    <section class="t-de-zone t-de-zone--gf">
      <header class="t-de-zone-header">
        <h3 class="t-subtitle">Grande finale</h3>
        <p class="t-de-hint">${escapeHtml(grandFinal.deHint || 'Le champion se décide ici.')}</p>
      </header>
      <div class="t-de-gf-wrap">
        ${renderMatchCard(tournament, grandFinal, { readonly, compact: true, matchOrder: order })}
      </div>
    </section>`;
}

export function renderDoubleEliminationView(tournament, { readonly = false } = {}) {
  const playOrder = computeDoubleElimPlayOrder(tournament);
  const wbMatches = tournament.state.matches.filter((m) => m.bracket === 'winner');
  const lbMatches = tournament.state.matches.filter((m) => m.bracket === 'loser');
  const grandFinal = tournament.state.matches.find((m) => m.bracket === 'final');

  let html = renderLegend();

  html += `
    <section class="t-de-zone t-de-zone--wb">
      <header class="t-de-zone-header">
        <h3 class="t-subtitle">Bracket Vainqueurs</h3>
        <p class="t-de-hint">Winner Bracket — progression vers la finale</p>
      </header>
      ${renderBracketTree(tournament, wbMatches, {
        readonly,
        compact: true,
        playOrder,
        getRoundKey: (m) => m.wbRound ?? m.round,
      })}
    </section>`;

  html += `
    <section class="t-de-zone t-de-zone--lb">
      <header class="t-de-zone-header">
        <h3 class="t-subtitle">Bracket Repêchage</h3>
        <p class="t-de-hint">Loser Bracket — 2e chance après une défaite en vainqueurs</p>
      </header>
      ${renderBracketTree(tournament, lbMatches, {
        readonly,
        compact: true,
        playOrder,
        getRoundKey: (m) => m.lbRound ?? m.round,
      })}
    </section>`;

  if (grandFinal) {
    html += renderGrandFinal(tournament, grandFinal, playOrder, readonly);
  }

  return `<div class="t-de-view" id="t-bracket-export">${html}</div>`;
}
