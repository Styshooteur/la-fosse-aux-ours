import { CONFIG } from './config.js?v=20260630a';
import { fetchLeaderboard, fetchFighterCards, gradeToClass } from './sheets.js?v=20260630a';
import { initLiveEventsNav, activateLiveEventsPanel, deactivateLiveEventsPanel } from './events.js?v=20260630a';
import { initHome, activateHomePanel, deactivateHomePanel } from './home.js?v=20260630a';
import { initArenaRulesPublic, openRulesModal, refreshRulesPage } from './arena-rules/modal.js?v=20260702f';
import { escapeHtml } from './utils.js?v=20260630a';

let allFightersData = [];
let fighterCards = {};
let refreshTimer = null;
let activePanel = 'home';

const $ = (id) => document.getElementById(id);

function normalizeSearch(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function getLeaderboardSearchQuery() {
  return $('leaderboard-search')?.value ?? '';
}

function updateSearchClearButton() {
  const clearBtn = $('leaderboard-search-clear');
  const input = $('leaderboard-search');
  if (!clearBtn || !input) return;
  const hasText = input.value.length > 0;
  clearBtn.classList.toggle('hidden', !hasText);
  clearBtn.hidden = !hasText;
}

function filterFightersBySearch(fighters, query) {
  const needle = normalizeSearch(query.trim());
  if (!needle) {
    return fighters.map((fighter, index) => ({ fighter, index }));
  }
  return fighters
    .map((fighter, index) => ({ fighter, index }))
    .filter(({ fighter }) => normalizeSearch(fighter.combattant).includes(needle));
}

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

const RANK_ONE_CROWN = `<span class="rank-crown" aria-hidden="true" title="Champion du classement">
  <svg viewBox="0 0 80 56" xmlns="http://www.w3.org/2000/svg" focusable="false">
    <defs>
      <linearGradient id="rankCrownGold" x1="40" y1="2" x2="40" y2="54" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f8df70"/>
        <stop offset="50%" stop-color="#ebc42a"/>
        <stop offset="100%" stop-color="#c9940c"/>
      </linearGradient>
    </defs>
    <path fill="url(#rankCrownGold)" d="M9 45.5 6.5 29.5 17 37.5 22.5 13.5 31.5 36 40 5.5 48.5 36 57.5 13.5 63 37.5 73.5 29.5 71 45.5Q40 51.5 9 45.5Z"/>
    <circle cx="22.5" cy="10.5" r="3.3" fill="url(#rankCrownGold)"/>
    <circle cx="40" cy="4.2" r="4" fill="url(#rankCrownGold)"/>
    <circle cx="57.5" cy="10.5" r="3.3" fill="url(#rankCrownGold)"/>
    <path fill="none" stroke="#f5ead0" stroke-width="3" stroke-linecap="round" d="M15 41.5Q40 38 65 41.5"/>
    <path fill="none" stroke="#f5ead0" stroke-width="3" stroke-linecap="round" d="M13 46.5Q40 43 67 46.5"/>
  </svg>
</span>`;

function renderLeaderboardRows(entries) {
  const tbody = $('leaderboard-body');

  if (!entries.length) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="leaderboard-empty">Aucun combattant trouvé</td></tr>';
    return;
  }

  tbody.innerHTML = entries
    .map(({ fighter: f, index: i }) => {
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
    })
    .join('');

  tbody.querySelectorAll('.fighter-link').forEach((btn) => {
    btn.addEventListener('click', () => openFighterCard(Number(btn.dataset.index)));
  });
}

function applyLeaderboardFilter() {
  if (!allFightersData.length) return;
  const entries = filterFightersBySearch(allFightersData, getLeaderboardSearchQuery());
  renderLeaderboardRows(entries);
  updateSearchClearButton();
}

function renderLeaderboard(fighters) {
  allFightersData = fighters;
  applyLeaderboardFilter();
}

function openFighterCard(index) {
  const fighter = allFightersData[index];
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

function switchPanel(panel) {
  activePanel = panel;
  const home = $('panel-home');
  const leaderboard = $('panel-leaderboard');
  const events = $('panel-events');
  const rules = $('panel-rules');
  const navHome = $('nav-home');
  const navLeaderboard = $('nav-leaderboard');
  const navRules = $('nav-rules');
  const navEvents = $('nav-events');

  if (home) home.classList.toggle('hidden', panel !== 'home');
  if (leaderboard) leaderboard.classList.toggle('hidden', panel !== 'leaderboard');
  if (events) events.classList.toggle('hidden', panel !== 'events');
  if (rules) rules.classList.toggle('hidden', panel !== 'rules');
  navHome?.classList.toggle('site-nav-btn--active', panel === 'home');
  navLeaderboard?.classList.toggle('site-nav-btn--active', panel === 'leaderboard');
  navRules?.classList.toggle('site-nav-btn--active', panel === 'rules');
  navEvents?.classList.toggle('site-nav-btn--active', panel === 'events');

  if (panel === 'home') {
    activateHomePanel();
    deactivateLiveEventsPanel();
  } else if (panel === 'events') {
    deactivateHomePanel();
    activateLiveEventsPanel();
  } else if (panel === 'rules') {
    deactivateHomePanel();
    deactivateLiveEventsPanel();
    refreshRulesPage();
  } else {
    deactivateHomePanel();
    deactivateLiveEventsPanel();
  }

  document.body.classList.toggle('page-home-active', panel === 'home');

  const backdrop = $('home-backdrop');
  if (backdrop) backdrop.hidden = panel !== 'home';
}

function setupEventListeners() {
  $('btn-refresh')?.addEventListener('click', loadData);
  $('home-rules-btn')?.addEventListener('click', () => openRulesModal('compact'));

  const searchInput = $('leaderboard-search');
  const searchClear = $('leaderboard-search-clear');

  searchInput?.addEventListener('input', applyLeaderboardFilter);

  searchClear?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    searchInput.focus();
    applyLeaderboardFilter();
  });

  $('card-close')?.addEventListener('click', closeFighterCard);
  $('fighter-modal')?.addEventListener('click', (e) => {
    if (e.target === $('fighter-modal')) closeFighterCard();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFighterCard();
  });

  document.querySelectorAll('.site-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      if (panel) switchPanel(panel);
    });
  });
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadData, CONFIG.refreshIntervalMs);
}

async function init() {
  setupEventListeners();
  switchPanel('home');
  initHome();
  initArenaRulesPublic();
  initLiveEventsNav();
  await loadData();
  startAutoRefresh();
}

init();
