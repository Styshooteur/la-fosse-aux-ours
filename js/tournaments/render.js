import { participantById, participantName } from './utils.js';

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

export function renderMatchCard(tournament, match) {
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
  const canPlay =
    match.participantAId &&
    match.participantBId &&
    match.status !== 'bye' &&
    !isBye;

  const nameA = waitingA ? 'En attente' : participantName(tournament, match.participantAId);
  const nameB = waitingB ? 'En attente' : participantName(tournament, match.participantBId);

  const scoreBlock = canPlay
    ? `<div class="t-match-scores">
        <input type="number" min="0" class="t-score-input" data-side="A" value="${match.scoreA ?? ''}" placeholder="0" />
        <span>vs</span>
        <input type="number" min="0" class="t-score-input" data-side="B" value="${match.scoreB ?? ''}" placeholder="0" />
      </div>`
    : completed
      ? `<span class="t-match-score">${match.scoreA ?? '—'} — ${match.scoreB ?? '—'}</span>`
      : isBye
        ? '<span class="t-match-score t-match-score--bye">Exempt — passage automatique</span>'
        : `<span class="t-match-score t-match-score--wait">${waitingA || waitingB ? 'En attente des qualifiés' : '—'}</span>`;

  let actions = '';
  if (canPlay) {
    actions = completed
      ? `<button type="button" class="t-btn t-btn--ghost t-btn-edit" data-match-id="${match.id}">Éditer</button>`
      : `<button type="button" class="t-btn t-btn--primary t-btn-validate" data-match-id="${match.id}">Valider le résultat</button>`;
  }

  return `
    <article class="t-match ${completed ? 't-match--done' : ''} ${isBye ? 't-match--bye' : ''}" data-match-id="${match.id}">
      <header class="t-match-header">
        <span>${escapeHtml(match.roundName || `Tour ${match.round}`)}</span>
        ${match.bracket ? `<span class="t-match-bracket">${escapeHtml(bracketLabel(match.bracket))}</span>` : ''}
      </header>
      <div class="t-match-body">
        <div class="t-match-player ${match.winnerId === match.participantAId ? 't-match-player--win' : ''} ${waitingA ? 't-match-player--wait' : ''}">
          <span class="t-color-dot" style="background:${waitingA ? '#ccc' : colorA}"></span>
          <span class="t-player-name">${crownIfWinner(match, match.participantAId, completed)}${escapeHtml(nameA)}</span>
        </div>
        ${scoreBlock}
        <div class="t-match-player ${match.winnerId === match.participantBId ? 't-match-player--win' : ''} ${waitingB ? 't-match-player--wait' : ''}">
          <span class="t-color-dot" style="background:${waitingB ? '#ccc' : colorB}"></span>
          <span class="t-player-name">${crownIfWinner(match, match.participantBId, completed)}${escapeHtml(nameB)}</span>
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

function matchTopPx(roundIndex, matchIndex, unitPx) {
  const mult = 2 ** roundIndex;
  return matchIndex * unitPx * mult + ((mult - 1) * unitPx) / 2;
}

export function renderEliminationBracket(tournament, bracketFilter = null, options = {}) {
  let matches = filterBracketMatches(tournament, bracketFilter, options);

  if (options.excludeLastLbRound && bracketFilter === 'loser' && matches.length) {
    const maxRound = Math.max(...matches.map((m) => m.round));
    matches = matches.filter((m) => m.round < maxRound);
  }

  if (!matches.length) return '<p class="t-empty">Aucun match.</p>';

  const maxRound = Math.max(...matches.map((m) => m.round));
  const rounds = [];
  for (let r = 1; r <= maxRound; r += 1) {
    const rm = matches.filter((m) => m.round === r);
    if (rm.length) rounds.push(rm);
  }

  const unitPx = 152;
  const firstCount = rounds[0]?.length || 1;
  const colHeight = firstCount * unitPx;
  const colW = 272;

  let svgLines = '';
  const colHtml = rounds
    .map((roundMatches, colIndex) => {
      const cells = roundMatches
        .map((match, rowIndex) => {
          const top = matchTopPx(colIndex, rowIndex, unitPx);
          const prevTop = rowIndex > 0 ? matchTopPx(colIndex, rowIndex - 1, unitPx) : 0;
          const marginTop = rowIndex === 0 ? top : top - prevTop - 132;

          if (colIndex < rounds.length - 1 && match.nextMatchId) {
            const nextCol = rounds[colIndex + 1];
            const nextMatch = nextCol.find((m) => m.id === match.nextMatchId);
            if (nextMatch) {
              const nextRow = nextCol.indexOf(nextMatch);
              const y1 = top + 68;
              const y2 = matchTopPx(colIndex + 1, nextRow, unitPx) + 68;
              const x1 = colIndex * colW + colW - 12;
              const x2 = (colIndex + 1) * colW + 12;
              const midX = (x1 + x2) / 2;
              svgLines += `<path d="M${x1} ${y1} H${midX} V${y2} H${x2}" fill="none" stroke="#7a1a1a" stroke-width="2" opacity="0.4"/>`;
            }
          }

          return `<div class="t-bracket-cell" style="margin-top:${Math.max(0, marginTop)}px">${renderMatchCard(tournament, match)}</div>`;
        })
        .join('');

      return `
        <div class="t-bracket-col-flex" style="width:${colW}px">
          <h4 class="t-bracket-round">${escapeHtml(roundMatches[0]?.roundName || `Tour ${colIndex + 1}`)}</h4>
          <div class="t-bracket-col-body" style="min-height:${colHeight}px">${cells}</div>
        </div>`;
    })
    .join('');

  const svgW = rounds.length * colW;

  return `
    <div class="t-bracket-wrap" id="t-bracket-export">
      <svg class="t-bracket-svg" width="${svgW}" height="${colHeight + 60}" viewBox="0 0 ${svgW} ${colHeight + 60}" aria-hidden="true">${svgLines}</svg>
      <div class="t-bracket-flex" style="min-height:${colHeight + 60}px;width:${svgW}px">${colHtml}</div>
    </div>`;
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
