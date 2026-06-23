import { participantById, participantName, displayParticipantName } from './utils.js';
import { computeStandings } from './standings.js';
import { STATUS } from './types.js';

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function bracketLabel(bracket) {
  if (bracket === 'winner') return 'Vainqueurs';
  if (bracket === 'loser') return 'Repêchage';
  if (bracket === 'final') return 'Finale';
  return bracket;
}

function isFinalMatch(match) {
  return (
    match.bracket === 'final' ||
    match.roundName === 'Finale' ||
    match.roundName === 'Grande finale'
  );
}

function championCrown(match) {
  const gradId = `tCrownGold-${match.id.replace(/[^a-z0-9]/gi, '')}`;
  return `<span class="rank-crown" aria-hidden="true" title="Champion du tournoi">
  <svg viewBox="0 0 80 56" xmlns="http://www.w3.org/2000/svg" focusable="false">
    <defs>
      <linearGradient id="${gradId}" x1="40" y1="2" x2="40" y2="54" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f8df70"/>
        <stop offset="50%" stop-color="#ebc42a"/>
        <stop offset="100%" stop-color="#c9940c"/>
      </linearGradient>
    </defs>
    <path fill="url(#${gradId})" d="M9 45.5 6.5 29.5 17 37.5 22.5 13.5 31.5 36 40 5.5 48.5 36 57.5 13.5 63 37.5 73.5 29.5 71 45.5Q40 51.5 9 45.5Z"/>
    <circle cx="22.5" cy="10.5" r="3.3" fill="url(#${gradId})"/>
    <circle cx="40" cy="4.2" r="4" fill="url(#${gradId})"/>
    <circle cx="57.5" cy="10.5" r="3.3" fill="url(#${gradId})"/>
    <path fill="none" stroke="#f5ead0" stroke-width="3" stroke-linecap="round" d="M15 41.5Q40 38 65 41.5"/>
    <path fill="none" stroke="#f5ead0" stroke-width="3" stroke-linecap="round" d="M13 46.5Q40 43 67 46.5"/>
  </svg>
</span>`;
}

function crownIfWinner(match, participantId, completed) {
  if (!completed || !match.winnerId || participantId !== match.winnerId) return '';
  if (!isFinalMatch(match)) return '';
  return championCrown(match);
}

export function getMatchAvailability(tournament, match) {
  const completed = match.status === 'completed';
  if (completed) return 'done';

  const waitingA = !match.participantAId;
  const waitingB = !match.participantBId;
  const pA = participantById(tournament, match.participantAId);
  const pB = participantById(tournament, match.participantBId);
  const isBye =
    (pA?.isBye && match.participantBId && !pB?.isBye) ||
    (pB?.isBye && match.participantAId && !pA?.isBye);

  if (waitingA || waitingB || match.status === 'bye' || isBye) return 'waiting';
  return 'playable';
}

const AVAILABILITY_LABELS = {
  waiting: 'En attente',
  playable: 'Jouable',
  done: 'Terminé',
};

export function renderMatchCard(tournament, match, options = {}) {
  const {
    readonly = false,
    compact = false,
    matchOrder = null,
    availability = null,
    editing = false,
  } = options;

  const avail = availability ?? getMatchAvailability(tournament, match);
  const pA = participantById(tournament, match.participantAId);
  const pB = participantById(tournament, match.participantBId);
  const colorA = pA?.color || '#8f6118';
  const colorB = pB?.color || '#495052';
  const completed = match.status === 'completed';
  const waitingA = !match.participantAId;
  const waitingB = !match.participantBId;
  const isBye =
    (pA?.isBye && match.participantBId && !pB?.isBye) ||
    (pB?.isBye && match.participantAId && !pA?.isBye);

  const nameA = waitingA ? (compact ? '—' : 'En attente') : displayParticipantName(tournament, match.participantAId);
  const nameB = waitingB ? (compact ? '—' : 'En attente') : displayParticipantName(tournament, match.participantBId);

  const hasBothParticipants =
    match.participantAId && match.participantBId && match.status !== 'bye' && !isBye;

  const showScoreInputs =
    !readonly && hasBothParticipants && (avail === 'playable' || editing);

  const scoreCenter = showScoreInputs
    ? `<div class="t-match-scores">
        <input type="number" min="0" class="t-score-input" data-side="A" value="${match.scoreA ?? ''}" placeholder="0" aria-label="Score ${escapeHtml(nameA)}" />
        <span class="t-match-score-sep" aria-hidden="true">—</span>
        <input type="number" min="0" class="t-score-input" data-side="B" value="${match.scoreB ?? ''}" placeholder="0" aria-label="Score ${escapeHtml(nameB)}" />
      </div>`
    : completed
      ? `<div class="t-match-scores t-match-scores--readonly"><span class="t-match-score-val">${match.scoreA ?? '—'}</span><span class="t-match-score-sep">—</span><span class="t-match-score-val">${match.scoreB ?? '—'}</span></div>`
      : isBye
        ? '<div class="t-match-scores t-match-scores--readonly"><span class="t-match-score t-match-score--bye">Exempt</span></div>'
        : `<div class="t-match-scores t-match-scores--readonly"><span class="t-match-score t-match-score--wait">${waitingA || waitingB ? '…' : '—'}</span></div>`;

  const validateLabel = compact ? 'Valider' : 'Valider le résultat';

  let actions = '';
  if (!readonly && hasBothParticipants) {
    if (editing) {
      actions = `
        <button type="button" class="t-btn t-btn--primary t-btn-validate" data-match-id="${match.id}">${validateLabel}</button>
        <button type="button" class="t-btn t-btn--ghost t-btn-cancel-edit" data-match-id="${match.id}">Annuler</button>`;
    } else if (completed) {
      actions = `<button type="button" class="t-btn t-btn--ghost t-btn-edit" data-match-id="${match.id}">Éditer</button>`;
    } else if (avail === 'playable') {
      actions = `<button type="button" class="t-btn t-btn--primary t-btn-validate" data-match-id="${match.id}">${validateLabel}</button>`;
    }
  }

  return `
    <article class="t-match t-match--${avail} ${compact ? 't-match--compact' : ''} ${editing ? 't-match--editing' : ''} ${isBye ? 't-match--bye' : ''}" data-match-id="${match.id}" data-availability="${avail}"${matchOrder != null ? ` title="Ordre de jeu M${matchOrder}"` : ''}>
      <span class="t-match-state">${AVAILABILITY_LABELS[avail]}</span>
      <div class="t-match-body">
        <div class="t-match-row">
          <div class="t-match-player t-match-player--a ${match.winnerId === match.participantAId ? 't-match-player--win' : ''} ${waitingA ? 't-match-player--wait' : ''}" title="${escapeHtml(participantName(tournament, match.participantAId))}">
            <span class="t-color-dot" style="background:${waitingA ? '#ccc' : colorA}"></span>
            <span class="t-player-name">${crownIfWinner(match, match.participantAId, completed)}${escapeHtml(nameA)}</span>
          </div>
          ${scoreCenter}
          <div class="t-match-player t-match-player--b ${match.winnerId === match.participantBId ? 't-match-player--win' : ''} ${waitingB ? 't-match-player--wait' : ''}" title="${escapeHtml(participantName(tournament, match.participantBId))}">
            <span class="t-player-name">${crownIfWinner(match, match.participantBId, completed)}${escapeHtml(nameB)}</span>
            <span class="t-color-dot" style="background:${waitingB ? '#ccc' : colorB}"></span>
          </div>
        </div>
      </div>
      ${actions ? `<footer class="t-match-actions">${actions}</footer>` : ''}
    </article>`;
}

export function renderStandingsTable(standings, { showBuchholz = false } = {}) {
  if (!standings?.length) {
    return '<p class="t-empty">Aucun classement disponible.</p>';
  }

  const buchholzCol = showBuchholz ? '<th>Buchholz</th>' : '';
  const rows = standings
    .map(
      (s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><span class="t-color-dot" style="background:${s.color || '#8f6118'}"></span> ${escapeHtml(s.name)}</td>
        <td>${s.pts}</td>
        <td>${s.wins}</td>
        <td>${s.draws}</td>
        <td>${s.losses}</td>
        <td>${s.diff >= 0 ? '+' : ''}${s.diff}</td>
        ${showBuchholz ? `<td>${s.buchholz}</td>` : ''}
      </tr>`
    )
    .join('');

  return `
    <table class="t-standings">
      <thead>
        <tr><th>#</th><th>Participant</th><th>Pts</th><th>V</th><th>N</th><th>D</th><th>Diff</th>${buchholzCol}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function filterBracketMatches(tournament, bracketFilter = null, { knockoutOnly = false } = {}) {
  return tournament.state.matches.filter((m) => {
    if (m.groupId || m.swissRound) return false;
    if (knockoutOnly) {
      const isKnockoutMatch =
        m.knockout ||
        (tournament.state.phase === 'knockout' && tournament.state.knockoutGenerated);
      if (!isKnockoutMatch) return false;
    }
    if (bracketFilter === 'winner') return m.bracket === 'winner' || m.bracket === null;
    if (bracketFilter === 'loser') return m.bracket === 'loser';
    if (bracketFilter === 'final') return m.bracket === 'final';
    return m.bracket !== 'loser';
  });
}

function layoutBracketPositions(rounds, linkField, unitPx, cardH) {
  const pos = new Map();

  rounds.forEach((roundMatches, colIndex) => {
    if (colIndex === 0) {
      roundMatches.forEach((m, i) => pos.set(m.id, i * unitPx));
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
          ? Math.max(...placed.map((rm) => pos.get(rm.id))) + unitPx
          : 0;
        pos.set(m.id, y);
      }
    });

    const sorted = [...roundMatches].sort((a, b) => pos.get(a.id) - pos.get(b.id));
    for (let i = 1; i < sorted.length; i++) {
      const minY = pos.get(sorted[i - 1].id) + unitPx;
      if (pos.get(sorted[i].id) < minY) pos.set(sorted[i].id, minY);
    }
  });

  return pos;
}

function columnBodyHeight(roundMatches, positions, cardH, pad = 12) {
  if (!roundMatches.length) return cardH + pad;
  const maxBottom = Math.max(...roundMatches.map((m) => positions.get(m.id) + cardH));
  return maxBottom + pad;
}

/**
 * Arbre SVG classique (colonnes par tour + connecteurs).
 * compact ≈ 25 % plus petit pour la double élimination.
 */
function matchCardOpts(match, options = {}) {
  const { editingMatchIds, ...rest } = options;
  return {
    ...rest,
    editing: rest.editing ?? editingMatchIds?.has(match.id) ?? false,
  };
}

export function renderBracketTree(tournament, matches, options = {}) {
  const {
    readonly = false,
    compact = false,
    playOrder = null,
    getRoundKey = (m) => m.round,
    linkField = 'nextMatchId',
    editingMatchIds = null,
    sortWithinRound = null,
  } = options;

  if (!matches.length) return '<p class="t-empty">Aucun match.</p>';

  const unitPx = compact ? 140 : 160;
  const colW = compact ? 336 : 300;
  const cardH = compact ? 116 : 124;
  const connY = cardH / 2 + (compact ? 16 : 18);

  const sortRoundMatches = (a, b) => {
    if (sortWithinRound) return sortWithinRound(a, b);
    return a.id.localeCompare(b.id);
  };

  const roundKeys = [...new Set(matches.map(getRoundKey))].sort((a, b) => a - b);
  const rounds = roundKeys.map((key) =>
    matches.filter((m) => getRoundKey(m) === key).sort(sortRoundMatches)
  );

  const positions = layoutBracketPositions(rounds, linkField, unitPx, cardH);
  const colHeights = rounds.map((rm) => columnBodyHeight(rm, positions, cardH));
  const treeHeight = Math.max(...colHeights, cardH);
  const headerOffset = compact ? 34 : 40;

  let svgLines = '';
  const colHtml = rounds
    .map((roundMatches, colIndex) => {
      const cells = roundMatches
        .map((match) => {
          const top = positions.get(match.id);

          const nextId = match[linkField];
          if (colIndex < rounds.length - 1 && nextId) {
            const nextCol = rounds[colIndex + 1];
            const nextMatch = nextCol.find((m) => m.id === nextId);
            if (nextMatch) {
              const y1 = top + connY;
              const y2 = positions.get(nextMatch.id) + connY;
              const x1 = colIndex * colW + colW - 12;
              const x2 = (colIndex + 1) * colW + 12;
              const midX = (x1 + x2) / 2;
              svgLines += `<path d="M${x1} ${y1} H${midX} V${y2} H${x2}" fill="none" stroke="#7a1a1a" stroke-width="${compact ? 1.5 : 2}" opacity="0.42"/>`;
            }
          }

          const order = playOrder?.get(match.id);
          return `<div class="t-bracket-cell t-bracket-cell--abs" style="top:${top}px">${renderMatchCard(tournament, match, matchCardOpts(match, { readonly, compact, matchOrder: order, editingMatchIds }))}</div>`;
        })
        .join('');

      return `
        <div class="t-bracket-col-flex" style="width:${colW}px">
          <h4 class="t-bracket-round">${escapeHtml(roundMatches[0]?.roundName || `Tour ${colIndex + 1}`)}</h4>
          <div class="t-bracket-col-body" style="height:${colHeights[colIndex]}px">${cells}</div>
        </div>`;
    })
    .join('');

  const svgW = rounds.length * colW;
  const totalH = treeHeight + headerOffset + 8;

  return `
    <div class="t-bracket-wrap ${compact ? 't-bracket-wrap--compact' : ''}" style="--t-col-w:${colW}px;--t-card-h:${cardH}px;--t-unit:${unitPx}px">
      <svg class="t-bracket-svg" width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}" aria-hidden="true">${svgLines}</svg>
      <div class="t-bracket-flex" style="min-height:${totalH}px;width:${svgW}px">${colHtml}</div>
    </div>`;
}

export function renderEliminationBracket(tournament, bracketFilter = null, options = {}) {
  const { knockoutOnly = false, excludeLastLbRound = false, readonly = false, editingMatchIds = null } =
    options;
  let matches = filterBracketMatches(tournament, bracketFilter, { knockoutOnly });

  if (excludeLastLbRound && bracketFilter === 'loser' && matches.length) {
    const maxRound = Math.max(...matches.map((m) => m.round));
    matches = matches.filter((m) => m.round < maxRound);
  }

  return renderBracketTree(tournament, matches, { readonly, editingMatchIds, getRoundKey: (m) => m.round });
}

export function renderDoubleEliminationFinale(tournament) {
  const lbMatches = tournament.state.matches.filter((m) => m.bracket === 'loser');
  const grandFinal = tournament.state.matches.find((m) => m.bracket === 'final');

  if (!lbMatches.length && !grandFinal) return '';

  const maxLbRound = Math.max(...lbMatches.map((m) => m.round), 0);
  const lastLbMatches = lbMatches.filter((m) => m.round === maxLbRound);

  let html = '<section class="t-finals-section">';
  if (lastLbMatches.length) {
    html += `
      <h4 class="t-subtitle">Finale du Loser Bracket</h4>
      <div class="t-match-list t-finals-row">
        ${lastLbMatches.map((m) => renderMatchCard(tournament, m)).join('')}
      </div>`;
  }
  if (grandFinal) {
    html += `
      <h4 class="t-subtitle">Grande finale</h4>
      <div class="t-match-list t-finals-row">
        ${renderMatchCard(tournament, grandFinal)}
      </div>`;
  }
  html += '</section>';
  return html;
}

function getSwissRoundNumbers(tournament) {
  const rounds = [
    ...new Set(tournament.state.matches.map((m) => m.swissRound).filter((r) => r != null)),
  ].sort((a, b) => a - b);
  return rounds.length ? rounds : [1];
}

export function renderSwissView(tournament, { canAdvance = false, readonly = false, editingMatchIds = null } = {}) {
  const totalRounds = tournament.settings.swissRounds || 1;
  const roundNumbers = getSwissRoundNumbers(tournament);
  const showNextButton =
    !readonly &&
    tournament.status !== STATUS.COMPLETED &&
    (tournament.settings.swissCurrentRound || 1) < totalRounds;

  const roundsHtml = roundNumbers
    .map((roundNum) => {
      const roundMatches = tournament.state.matches.filter((m) => m.swissRound === roundNum);
      const standings = computeStandings(tournament, { maxSwissRound: roundNum });
      return `
        <section class="t-swiss-round">
          <p class="t-swiss-round-label">Ronde ${roundNum} / ${totalRounds}</p>
          <div class="t-match-list">${roundMatches.map((m) => renderMatchCard(tournament, m, matchCardOpts(m, { readonly, editingMatchIds }))).join('')}</div>
          <h3 class="t-subtitle">Classement</h3>
          ${renderStandingsTable(standings, { showBuchholz: true })}
        </section>`;
    })
    .join('');

  const nextBtn = showNextButton
    ? `<div class="t-swiss-actions">
        <button type="button" class="t-btn t-btn--primary" id="t-swiss-next" ${canAdvance ? '' : 'disabled'}>
          Générer la ronde suivante
        </button>
      </div>`
    : '';

  return `<div class="t-swiss-view" id="t-bracket-export">${roundsHtml}${nextBtn}</div>`;
}

export function exportTournamentJson(tournament) {
  const blob = new Blob([JSON.stringify(tournament, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tournament.name.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportBracketPng(container) {
  const target = container.querySelector('#t-bracket-export') || container.querySelector('.tournament-view-body') || container;
  const html = `
    <div xmlns="http://www.w3.org/1999/xhtml" style="background:#faf3e4;padding:16px;font-family:Georgia,serif">
      ${target.innerHTML}
    </div>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${target.scrollWidth}" height="${target.scrollHeight}">
    <foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  const img = new Image();
  const canvas = document.createElement('canvas');
  canvas.width = target.scrollWidth * 2;
  canvas.height = target.scrollHeight * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  await new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bracket.png';
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
