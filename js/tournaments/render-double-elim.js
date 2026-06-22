import { escapeHtml, renderMatchCard } from './render.js';
import { getDoubleElimRounds } from './double-elim.js';

const EXPLAINER = `
  <div class="t-de-explainer">
    <strong>Comment ça marche ?</strong>
    <ul>
      <li><strong>Vainqueurs</strong> — comme une élimination classique : une défaite envoie au repêchage.</li>
      <li><strong>Repêchage</strong> — une 2e chance : il faut perdre deux fois pour être éliminé.</li>
      <li><strong>Grande finale</strong> — le dernier du bracket vainqueurs affronte le survivant du repêchage.</li>
    </ul>
  </div>`;

function renderRoundSection(title, rounds, tournament, readonly = false) {
  if (!rounds.length) return '';

  const roundsHtml = rounds
    .map(
      (round) => `
      <section class="t-de-round">
        <header class="t-de-round-header">
          <h4>${escapeHtml(round.label)}</h4>
          ${round.hint ? `<p class="t-de-hint">${escapeHtml(round.hint)}</p>` : ''}
        </header>
        <div class="t-match-list">
          ${round.matches.map((m) => renderMatchCard(tournament, m, { readonly })).join('')}
        </div>
      </section>`
    )
    .join('');

  return `
    <div class="t-de-bracket">
      <h3 class="t-subtitle">${escapeHtml(title)}</h3>
      <div class="t-de-rounds">${roundsHtml}</div>
    </div>`;
}

export function renderDoubleEliminationView(tournament, { readonly = false } = {}) {
  const { wbRounds, lbRounds, grandFinal } = getDoubleElimRounds(tournament);

  let html = EXPLAINER;
  html += renderRoundSection('Bracket Vainqueurs', wbRounds, tournament, readonly);
  html += renderRoundSection('Bracket Repêchage (Loser)', lbRounds, tournament, readonly);

  if (grandFinal) {
    html += `
      <section class="t-finals-section">
        <h3 class="t-subtitle">Grande finale</h3>
        <p class="t-de-hint">${escapeHtml(grandFinal.deHint || 'Le champion se décide ici.')}</p>
        <div class="t-match-list t-finals-row">
          ${renderMatchCard(tournament, grandFinal, { readonly })}
        </div>
      </section>`;
  }

  return `<div class="t-de-view" id="t-bracket-export">${html}</div>`;
}
