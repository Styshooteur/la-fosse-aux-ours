import { CONFIG } from './config.js?v=20260620f';
import { fetchLeaderboard, fetchFighterCards, gradeToClass } from './sheets.js?v=20260620f';
let fightersData = [];
let fighterCards = {};
let refreshTimer = null;

const $ = (id) => document.getElementById(id);

function formatTime(date) {
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function setVisible(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  el.classList.toggle('hidden', !visible);
}

function showLoading(show) {
  setVisible($('loading'), show);
  setVisible($('leaderboard'), !show);
}

function showError(message) {
  const el = $('error-message');
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideError() {
  $('error-message').classList.add('hidden');
}

function renderStats(stats) {
  $('stat-fighters').textContent = stats.combattants ?? '—';
  $('stat-matches').textContent = stats.matchs ?? '—';
  $('stat-best-elo').textContent = stats.meilleurElo ?? '—';
  $('stat-avg-elo').textContent = stats.eloMoyen ?? '—';
  $('stat-last-match').textContent = stats.dernierMatch ?? '—';
}

function renderGradeLegend(legend) {
  const section = $('grades-legend');
  if (!legend.length) {
    setVisible(section, false);
    return;
  }

  const grid = $('grades-grid');
  grid.innerHTML = legend
    .map(
      (g) => `
      <div class="grade-legend-item ${gradeToClass(g.name)}">
        <span class="grade-legend-rank">${g.rank}</span>
        <span class="grade-legend-swatch"></span>
        <span class="grade-legend-label">${escapeHtml(g.name)}</span>
      </div>`
    )
    .join('');

  setVisible(section, true);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

const RANK_ONE_CROWN = `<span class="rank-crown" aria-hidden="true" title="Champion du classement">
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false">
    <path d="M3 18h18v2H3v-2zm2.2-8.4 2.8 3.4 3-5.2 3 5.2 2.8-3.4L19 18H5l.2-8.4zM5.5 7.5 3 4l3.5 1.2L12 3l5.5 2.2L21 4l-2.5 3.5L12 8 5.5 7.5z"/>
  </svg>
</span>`;

function renderLeaderboard(fighters) {
  fightersData = fighters;
  const tbody = $('leaderboard-body');
  tbody.innerHTML = fighters
    .map(
      (f, i) => {
        const gradeClass = gradeToClass(f.grade);
        const isFirst = Number(f.rang) === 1;
        const crown = isFirst ? RANK_ONE_CROWN : '';
        return `
    <tr>
      <td>${escapeHtml(String(f.rang))}</td>
      <td class="grade-cell"><span class="grade-badge ${gradeClass}">${escapeHtml(f.grade)}</span></td>
      <td>
        <button type="button" class="fighter-link" data-index="${i}">
          ${crown}${escapeHtml(f.combattant)}
        </button>
      </td>
      <td>${escapeHtml(String(f.points))}</td>
      <td>${escapeHtml(String(f.matchs))}</td>
      <td>${escapeHtml(String(f.victoires))}</td>
      <td>${escapeHtml(String(f.defaites))}</td>
      <td>${escapeHtml(String(f.winPct))}</td>
      <td>${escapeHtml(f.actif)}</td>
    </tr>`;
      }
    )
    .join('');

  tbody.querySelectorAll('.fighter-link').forEach((btn) => {
    btn.addEventListener('click', () => openFighterCard(Number(btn.dataset.index)));
  });
}

function openFighterCard(index) {
  const fighter = fightersData[index];
  if (!fighter) return;

  const name = fighter.combattant;
  const card = fighterCards[name] || {};
  const img = $('card-image');
  const missing = $('portrait-missing');

  if (card.image) {
    img.src = `${card.image}?v=${Date.now()}`;
    img.alt = `Portrait de ${name}`;
    img.hidden = false;
    missing.hidden = true;
  } else {
    img.removeAttribute('src');
    img.alt = '';
    img.hidden = true;
    missing.hidden = false;
  }

  $('fighter-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeFighterCard() {
  $('fighter-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

async function loadData() {
  const btn = $('btn-refresh');
  if (btn) btn.disabled = true;
  showLoading(true);
  hideError();

  try {
    if (window.location.protocol === 'file:') {
      throw new Error(
        'Ouvrez le site via le serveur local : http://localhost:3000 (lancez start.bat).'
      );
    }

    const [leaderboard, cards] = await Promise.all([
      fetchLeaderboard(),
      fetchFighterCards(),
    ]);

    fighterCards = cards;
    renderStats(leaderboard.stats);
    renderLeaderboard(leaderboard.fighters);
    renderGradeLegend(leaderboard.gradeLegend);

    if (!leaderboard.fighters.length) {
      throw new Error('Aucun combattant trouvé dans le registre.');
    }

    $('last-updated').textContent = `Dernière mise à jour : ${formatTime(new Date())}`;
    showLoading(false);
  } catch (err) {
    showLoading(false);
    showError(
      err.message ||
        'Impossible de charger le registre. Vérifiez que la feuille Google est partagée en lecture.'
    );
    console.error(err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function setupEventListeners() {
  $('btn-refresh').addEventListener('click', loadData);
  $('card-close').addEventListener('click', closeFighterCard);
  $('fighter-modal').addEventListener('click', (e) => {
    if (e.target === $('fighter-modal')) closeFighterCard();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFighterCard();
  });
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadData, CONFIG.refreshIntervalMs);
}

async function init() {
  setupEventListeners();
  await loadData();
  startAutoRefresh();
}

init();
