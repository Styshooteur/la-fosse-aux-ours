import { fetchLeaderboard, gradeToClass } from './sheets.js?v=20260627a';
import { openPortraitEditor } from './portrait-editor.js';
import {
  calculateEloMatch,
  formatPercent,
  formatModifier,
  formatDelta,
} from './elo-calculator.js?v=20260627a';
import { initTournamentsAdmin } from './tournaments/tournament-app.js?v=20260630a';
import { initOpeningHoursAdmin } from './opening-hours/admin.js?v=20260630a';
import { initArenaRulesAdmin } from './arena-rules/admin.js?v=20260702e';
import { escapeHtml } from './utils.js?v=20260630a';

const PIN_KEY = 'fosse-admin-pin';
const $ = (id) => document.getElementById(id);

let fighters = [];
let portraits = {};
let customPortraits = new Set();
let selectedWinner = null;
let tournamentsAdmin = null;
let openingHoursAdmin = null;
let arenaRulesAdmin = null;

function showStatus(message, isError = false) {
  const el = $('admin-status');
  el.textContent = message;
  el.classList.toggle('admin-status--error', isError);
  el.classList.remove('hidden');
  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function getPin() {
  return sessionStorage.getItem(PIN_KEY) || '';
}

function setPin(pin) {
  sessionStorage.setItem(PIN_KEY, pin);
}

async function verifyPin(pin) {
  const response = await fetch('/api/admin/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.valid === true;
}

async function refreshPortraitsFromServer() {
  const response = await fetch('/api/fighters', { cache: 'no-store' });
  if (!response.ok) return;
  const data = await response.json();
  portraits = data.fighters || {};
  customPortraits = new Set(data.customPortraits || []);
}
async function loadFighters() {
  const [leaderboard] = await Promise.all([fetchLeaderboard()]);
  fighters = leaderboard.fighters;
  await refreshPortraitsFromServer();
}

function normalizeSearch(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function getPortraitSearchQuery() {
  return $('admin-portrait-search')?.value ?? '';
}

function updatePortraitSearchClearButton() {
  const clearBtn = $('admin-portrait-search-clear');
  const input = $('admin-portrait-search');
  if (!clearBtn || !input) return;
  const hasText = input.value.length > 0;
  clearBtn.classList.toggle('hidden', !hasText);
  clearBtn.hidden = !hasText;
}

function filterFightersBySearch(fightersList, query) {
  const needle = normalizeSearch(query.trim());
  if (!needle) return fightersList;
  return fightersList.filter((f) => normalizeSearch(f.combattant).includes(needle));
}

function bindAdminListItems(list) {
  list.querySelectorAll('.admin-item').forEach((item) => {
    const name = decodeURIComponent(item.dataset.name);
    const fileInput = item.querySelector('.admin-file');

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;

      try {
        const dataUrl = await openPortraitEditor(file, name);
        await uploadPortrait(name, dataUrl);
      } catch (err) {
        if (err.message !== 'Édition annulée.') {
          showStatus(err.message, true);
        }
      }
    });

    const deleteBtn = item.querySelector('[data-action="delete-portrait"]');
    deleteBtn?.addEventListener('click', async () => {
      if (
        !confirm(
          `Supprimer le portrait de ${name} ?\nLe combattant n'aura plus d'image personnalisée sur le site.`
        )
      ) {
        return;
      }
      await deletePortrait(name);
    });
  });
}

function renderAdminListItems(fightersToShow, hasSearchQuery) {
  const list = $('admin-list');

  if (!fightersToShow.length) {
    list.innerHTML = hasSearchQuery
      ? '<p class="admin-list-empty">Aucun combattant trouvé</p>'
      : '';
    return;
  }

  list.innerHTML = fightersToShow
    .map((f) => {
      const image = portraits[f.combattant]?.image;
      const thumb = image
        ? `<img class="admin-thumb" src="${image}?v=${Date.now()}" alt="" />`
        : '<div class="admin-thumb admin-thumb--empty">Aucun<br>portrait</div>';

      const hasCustom = customPortraits.has(f.combattant);

      return `
        <article class="admin-item" data-name="${encodeURIComponent(f.combattant)}">
          ${thumb}
          <div class="admin-item-info">
            <h3>${escapeHtml(f.combattant)}</h3>
            <p><span class="grade-badge ${gradeToClass(f.grade)}">${escapeHtml(f.grade)}</span> · Rang ${escapeHtml(String(f.rang))}</p>
          </div>
          <div class="admin-item-actions">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="admin-file" />
            <span class="admin-file-hint">Choisir une photo pour l'ajuster</span>
            ${
              hasCustom
                ? `<button type="button" class="admin-btn-delete" data-action="delete-portrait">Supprimer le portrait</button>`
                : ''
            }
          </div>
        </article>`;
    })
    .join('');

  bindAdminListItems(list);
}

function applyPortraitFilter() {
  if (!fighters.length) {
    $('admin-list').innerHTML = '';
    updatePortraitSearchClearButton();
    return;
  }

  const query = getPortraitSearchQuery();
  const filtered = filterFightersBySearch(fighters, query);
  renderAdminListItems(filtered, query.trim().length > 0);
  updatePortraitSearchClearButton();
}

function renderAdminList() {
  applyPortraitFilter();
}

async function uploadPortrait(name, dataUrl) {
  showStatus(`Enregistrement du portrait de ${name}…`);

  try {
    const response = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: getPin(),
        fighterName: name,
        imageData: dataUrl,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Échec de l\'envoi.');
    }

    portraits[name] = { image: result.image };
    customPortraits.add(name);
    await refreshPortraitsFromServer();
    renderAdminList();
    showStatus(`Portrait de ${name} enregistré.`);
  } catch (err) {
    showStatus(err.message, true);
  }
}

async function deletePortrait(name) {
  showStatus(`Suppression du portrait de ${name}…`);

  try {
    const response = await fetch('/api/admin/delete-portrait', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: getPin(),
        fighterName: name,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Échec de la suppression.');
    }

    delete portraits[name];
    customPortraits.delete(name);
    await refreshPortraitsFromServer();
    renderAdminList();
    showStatus(`Portrait de ${name} supprimé.`);
  } catch (err) {
    showStatus(err.message, true);
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach((btn) => {
    const active = btn.dataset.tab === tabId;
    btn.classList.toggle('admin-tab--active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  document.querySelectorAll('.admin-tab-panel').forEach((panel) => {
    const show =
      (tabId === 'portraits' && panel.id === 'tab-portraits') ||
      (tabId === 'hours' && panel.id === 'tab-hours') ||
      (tabId === 'tournaments' && panel.id === 'tab-tournaments') ||
      (tabId === 'rules' && panel.id === 'tab-rules') ||
      (tabId === 'elo' && panel.id === 'tab-elo');
    panel.classList.toggle('hidden', !show);
    panel.hidden = !show;
  });

  if (tabId === 'hours' && openingHoursAdmin) {
    openingHoursAdmin.open();
  }

  if (tabId === 'tournaments' && tournamentsAdmin) {
    tournamentsAdmin.open();
  }

  if (tabId === 'rules' && arenaRulesAdmin) {
    arenaRulesAdmin.open();
  }
}

function setupPortraitSearch() {
  const searchInput = $('admin-portrait-search');
  const searchClear = $('admin-portrait-search-clear');

  searchInput?.addEventListener('input', applyPortraitFilter);

  searchClear?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    searchInput.focus();
    applyPortraitFilter();
  });
}

function setupTabs() {
  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function updateWinnerButtons() {
  $('elo-winner-a').classList.toggle('elo-winner-btn--selected', selectedWinner === 'A');
  $('elo-winner-b').classList.toggle('elo-winner-btn--selected', selectedWinner === 'B');
}

function fighterDisplayName(side, fallback) {
  const name = $(`elo-${side}-name`).value.trim();
  return name || fallback;
}

function renderEloResultCard(side, data, displayName) {
  const card = $(`elo-result-${side}`);
  const deltaClass =
    data.delta >= 0 ? 'elo-result-delta--positive' : 'elo-result-delta--negative';

  card.querySelector('.elo-result-name').textContent = displayName;
  card.querySelector('.elo-result-new').innerHTML =
    `Nouvel Elo : <strong>${data.newElo}</strong>`;
  const deltaEl = card.querySelector('.elo-result-delta');
  deltaEl.textContent = formatDelta(data.delta);
  deltaEl.className = `elo-result-delta ${deltaClass}`;
}

function renderEloDetails(result, nameA, nameB) {
  const { fighterA: a, fighterB: b } = result;

  const winrateLine = (fighter, name) => {
    if (fighter.winrate === null) {
      return `<div class="elo-details-row">
        <span class="elo-details-label">${escapeHtml(name)} — winrate</span>
        <span class="elo-details-value">Moins de 10 matchs (modificateur neutre ${formatModifier(1)})</span>
      </div>`;
    }
    return `<div class="elo-details-row">
      <span class="elo-details-label">${escapeHtml(name)} — winrate</span>
      <span class="elo-details-value">${formatPercent(fighter.winrate)} · modificateur ${formatModifier(fighter.modifier)}</span>
    </div>`;
  };

  $('elo-details').innerHTML = `
    <h4>Détails du calcul</h4>
    <div class="elo-details-list">
      <div class="elo-details-row">
        <span class="elo-details-label">${escapeHtml(nameA)} — probabilité de victoire attendue</span>
        <span class="elo-details-value">${formatPercent(a.expected)}</span>
      </div>
      <div class="elo-details-row">
        <span class="elo-details-label">${escapeHtml(nameB)} — probabilité de victoire attendue</span>
        <span class="elo-details-value">${formatPercent(b.expected)}</span>
      </div>
      ${winrateLine(a, nameA)}
      ${winrateLine(b, nameB)}
    </div>`;
}

function hideEloError() {
  const el = $('elo-error');
  el.textContent = '';
  el.classList.add('hidden');
}

function showEloError(message) {
  const el = $('elo-error');
  el.textContent = message;
  el.classList.remove('hidden');
  $('elo-results').classList.add('hidden');
}

function runEloCalculation() {
  hideEloError();

  try {
    const result = calculateEloMatch({
      fighterA: {
        elo: $('elo-a-rating').value,
        victoires: $('elo-a-wins').value,
        matchsJoues: $('elo-a-matches').value,
      },
      fighterB: {
        elo: $('elo-b-rating').value,
        victoires: $('elo-b-wins').value,
        matchsJoues: $('elo-b-matches').value,
      },
      winner: selectedWinner,
    });

    const nameA = fighterDisplayName('a', 'Combattant A');
    const nameB = fighterDisplayName('b', 'Combattant B');

    renderEloResultCard('a', result.fighterA, nameA);
    renderEloResultCard('b', result.fighterB, nameB);
    renderEloDetails(result, nameA, nameB);

    $('elo-results').classList.remove('hidden');
  } catch (err) {
    showEloError(err.message);
  }
}

function setupEloCalculator() {
  $('elo-winner-a').addEventListener('click', () => {
    selectedWinner = 'A';
    updateWinnerButtons();
  });

  $('elo-winner-b').addEventListener('click', () => {
    selectedWinner = 'B';
    updateWinnerButtons();
  });

  $('elo-calc-btn').addEventListener('click', runEloCalculation);
}

async function unlockAdmin(pin) {
  const valid = await verifyPin(pin);
  if (!valid) {
    sessionStorage.removeItem(PIN_KEY);
    showStatus('Code administrateur incorrect.', true);
    return false;
  }

  setPin(pin);
  $('admin-auth').classList.add('hidden');
  $('admin-panel').classList.remove('hidden');

  if (!tournamentsAdmin) {
    tournamentsAdmin = initTournamentsAdmin({
      root: $('tournaments-root'),
      getPin,
      showStatus,
    });
  }

  if (!openingHoursAdmin) {
    openingHoursAdmin = initOpeningHoursAdmin({
      root: $('opening-hours-root'),
      getPin,
      showStatus,
    });
  }

  if (!arenaRulesAdmin) {
    arenaRulesAdmin = initArenaRulesAdmin({
      root: $('arena-rules-root'),
      getPin,
      showStatus,
    });
  }

  await loadFighters();
  renderAdminList();
  return true;
}

async function init() {
  setupTabs();
  setupPortraitSearch();
  setupEloCalculator();

  const savedPin = getPin();
  if (savedPin && (await unlockAdmin(savedPin))) {
    return;
  }

  $('btn-auth').addEventListener('click', () => {
    const pin = $('admin-pin').value.trim();
    if (!pin) {
      showStatus('Entrez le code administrateur.', true);
      return;
    }
    unlockAdmin(pin);
  });

  $('admin-pin').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btn-auth').click();
  });
}

init();
