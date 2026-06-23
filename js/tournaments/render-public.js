import { FORMATS, FORMAT_LABELS } from './types.js';
import { refreshDerivedState } from './engine.js';
import { computeStandings } from './standings.js';
import {
  escapeHtml,
  renderMatchCard,
  renderStandingsTable,
  renderEliminationBracket,
  renderSwissView,
} from './render.js';
import { renderDoubleEliminationView } from './render-double-elim.js?v=20260625a';

const READONLY = { readonly: true };

export function renderTournamentBracket(tournament) {
  refreshDerivedState(tournament);
  const t = tournament;

  if (t.format === FORMATS.SINGLE_ELIMINATION) {
    return renderEliminationBracket(t, null, READONLY);
  }
  if (t.format === FORMATS.DOUBLE_ELIMINATION) {
    return renderDoubleEliminationView(t, READONLY);
  }
  if (t.format === FORMATS.ROUND_ROBIN) {
    return `
      <div class="t-match-list">${t.state.matches.map((m) => renderMatchCard(t, m, READONLY)).join('')}</div>
      <h3 class="t-subtitle">Classement</h3>
      ${renderStandingsTable(t.state.standings)}`;
  }
  if (t.format === FORMATS.GROUP_STAGE) {
    const groupsHtml = (t.state.groups || [])
      .map((g) => {
        const groupMatches = t.state.matches.filter((m) => m.groupId === g.id);
        const standings = computeStandings(t, { groupId: g.id });
        return `
          <section class="t-group">
            <h3 class="t-subtitle">${escapeHtml(g.name)}</h3>
            <div class="t-match-list">${groupMatches.map((m) => renderMatchCard(t, m, READONLY)).join('')}</div>
            ${renderStandingsTable(standings)}
          </section>`;
      })
      .join('');
    const knockout =
      t.state.phase === 'knockout'
        ? `<h3 class="t-subtitle">Phase éliminatoire</h3>${renderEliminationBracket(t, null, { knockoutOnly: true, readonly: true })}`
        : '';
    return groupsHtml + knockout;
  }
  if (t.format === FORMATS.SWISS) {
    return renderSwissView(t, { readonly: true });
  }
  return '<p class="t-empty">Format non pris en charge.</p>';
}

export function renderLiveTournamentCard(tournament) {
  const participantCount =
    tournament.participants?.filter((p) => !p.isBye).length ||
    tournament.settings?.participantCount ||
    0;

  let bracketHtml;
  try {
    bracketHtml = renderTournamentBracket(tournament);
  } catch (err) {
    console.error('Erreur rendu tournoi', tournament.id, err);
    bracketHtml =
      '<p class="t-empty">Impossible d\'afficher le bracket de ce tournoi.</p>';
  }

  return `
    <article class="live-event-card" data-tournament-id="${escapeHtml(tournament.id)}">
      <header class="live-event-header">
        <div>
          <h3 class="live-event-title">${escapeHtml(tournament.name)}</h3>
          <p class="live-event-meta">
            ${escapeHtml(FORMAT_LABELS[tournament.format] || tournament.format)}
            · ${participantCount} participants
          </p>
        </div>
        <span class="live-badge" aria-label="En direct">
          <span class="live-badge-dot"></span>
          En direct
        </span>
      </header>
      <div class="live-event-bracket tournament-view-body t-public-readonly">
        ${bracketHtml}
      </div>
    </article>`;
}

export function renderLiveEventsPage(tournaments) {
  if (!tournaments.length) {
    return '<p class="live-events-empty">Aucun événement en cours pour le moment.</p>';
  }
  return tournaments.map((t) => renderLiveTournamentCard(t)).join('');
}
