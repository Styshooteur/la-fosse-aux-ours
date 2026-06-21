import { participantById, participantName } from './utils.js';

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

export function renderMatchCard(tournament, match) {
  const pA = participantById(tournament, match.participantAId);
  const pB = participantById(tournament, match.participantBId);
  const colorA = pA?.color || '#8f6118';
  const colorB = pB?.color || '#495052';
  const completed = match.status === 'completed';
  const canPlay = match.participantAId && match.participantBId && match.status !== 'bye';

  const scoreBlock = canPlay
    ? `<div class="t-match-scores">
        <input type="number" min="0" class="t-score-input" data-side="A" value="${match.scoreA ?? ''}" placeholder="0" />
        <span>vs</span>
        <input type="number" min="0" class="t-score-input" data-side="B" value="${match.scoreB ?? ''}" placeholder="0" />
      </div>`
    : `<span class="t-match-score">${match.scoreA ?? '—'} — ${match.scoreB ?? '—'}</span>`;

  const actions = !canPlay
    ? ''
    : completed
      ? `<button type="button" class="t-btn t-btn--ghost t-btn-edit" data-match-id="${match.id}">Éditer</button>`
      : `<button type="button" class="t-btn t-btn--primary t-btn-validate" data-match-id="${match.id}">Valider le résultat</button>`;

  return `
    <article class="t-match ${completed ? 't-match--done' : ''}" data-match-id="${match.id}">
      <header class="t-match-header">
        <span>${escapeHtml(match.roundName || `Tour ${match.round}`)}</span>
        ${match.bracket ? `<span class="t-match-bracket">${escapeHtml(match.bracket)}</span>` : ''}
      </header>
      <div class="t-match-body">
        <div class="t-match-player ${match.winnerId === match.participantAId ? 't-match-player--win' : ''}">
          <span class="t-color-dot" style="background:${colorA}"></span>
          <span class="t-player-name">${escapeHtml(participantName(tournament, match.participantAId))}</span>
        </div>
        ${scoreBlock}
        <div class="t-match-player ${match.winnerId === match.participantBId ? 't-match-player--win' : ''}">
          <span class="t-color-dot" style="background:${colorB}"></span>
          <span class="t-player-name">${escapeHtml(participantName(tournament, match.participantBId))}</span>
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

export function renderEliminationBracket(tournament, bracketFilter = null) {
  const matches = tournament.state.matches.filter((m) => {
    if (m.groupId || m.swissRound) return false;
    if (bracketFilter === 'winner') return m.bracket === 'winner' || m.bracket === null;
    if (bracketFilter === 'loser') return m.bracket === 'loser';
    if (bracketFilter === 'final') return m.bracket === 'final';
    return m.bracket !== 'loser';
  });

  if (!matches.length) return '<p class="t-empty">Aucun match.</p>';

  const maxRound = Math.max(...matches.map((m) => m.round));
  const rounds = [];
  for (let r = 1; r <= maxRound; r += 1) {
    const rm = matches.filter((m) => m.round === r);
    if (rm.length) rounds.push(rm);
  }

  const matchH = 88;
  const colW = 230;
  const svgW = rounds.length * colW + 40;
  const slotsInFirst = rounds[0]?.length || 1;
  const svgH = slotsInFirst * 104 + 40;

  let svgLines = '';
  const colHtml = rounds
    .map((roundMatches, colIndex) => {
      const slotH = (svgH - 40) / roundMatches.length;
      const cards = roundMatches
        .map((match, rowIndex) => {
          const top = 20 + rowIndex * slotH + (slotH - matchH) / 2;
          if (colIndex < rounds.length - 1 && match.nextMatchId) {
            const nextCol = rounds[colIndex + 1];
            const nextMatch = nextCol.find((m) => m.id === match.nextMatchId);
            if (nextMatch) {
              const nextRow = nextCol.indexOf(nextMatch);
              const nextSlotH = (svgH - 40) / nextCol.length;
              const y1 = top + matchH / 2;
              const y2 = 20 + nextRow * nextSlotH + (nextSlotH - matchH) / 2 + matchH / 2;
              const x1 = 20 + colIndex * colW + colW - 10;
              const x2 = 20 + (colIndex + 1) * colW + 10;
              const midX = (x1 + x2) / 2;
              svgLines += `<path d="M${x1} ${y1} H${midX} V${y2} H${x2}" fill="none" stroke="#7a1a1a" stroke-width="2" opacity="0.45"/>`;
            }
          }
          return `<div class="t-bracket-slot" style="top:${top}px">${renderMatchCard(tournament, match)}</div>`;
        })
        .join('');

      return `
        <div class="t-bracket-col" style="width:${colW}px">
          <h4 class="t-bracket-round">${escapeHtml(roundMatches[0]?.roundName || `Tour ${colIndex + 1}`)}</h4>
          <div class="t-bracket-col-inner" style="height:${svgH}px">${cards}</div>
        </div>`;
    })
    .join('');

  return `
    <div class="t-bracket-wrap" id="t-bracket-export">
      <svg class="t-bracket-svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">${svgLines}</svg>
      <div class="t-bracket-grid" style="width:${svgW}px;min-height:${svgH}px">${colHtml}</div>
    </div>`;
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
