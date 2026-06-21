import { fetchLeaderboard, fetchFighterCards, gradeToClass } from './sheets.js?v=20260620f';
import { openPortraitEditor } from './portrait-editor.js';
import {
  calculateEloMatch,
  formatPercent,
  formatModifier,
  formatDelta,
} from './elo-calculator.js?v=20260620i';
import { initTournamentsAdmin } from './tournaments/tournament-app.js?v=20260620o';

const PIN_KEY = 'fosse-admin-pin';
const $ = (id) => document.getElementById(id);

let fighters = [];
let portraits = {};
let selectedWinner = null;
let tournamentsAdmin = null;

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

async function loadFighters() {
  const [leaderboard, cards] = await Promise.all([
    fetchLeaderboard(),
    fetchFighterCards(),
  ]);
  fighters = leaderboard.fighters;
  portraits = cards;
}

function renderAdminList() {
  const list = $('admin-list');
  list.innerHTML = fighters
    .map((f) => {
      const image = portraits[f.combattant]?.image;
      const thumb = image
        ? `<img class="admin-thumb" src="${image}?v=${Date.now()}" alt="" />`
        : '<div class="admin-thumb admin-thumb--empty">Aucun<br>portrait</div>';

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
          </div>
        </article>`;
    })
    .join('');

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
  });
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
    // Recharger depuis le serveur pour confirmer l'enregistrement
    portraits = await fetchFighterCards();
    renderAdminList();
    showStatus(`Portrait de ${name} enregistré.`);
  } catch (err) {
    showStatus(err.message, true);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
      (tabId === 'tournaments' && panel.id === 'tab-tournaments') ||
      (tabId === 'elo' && panel.id === 'tab-elo');
    panel.classList.toggle('hidden', !show);
    panel.hidden = !show;
  });

  if (tabId === 'tournaments' && tournamentsAdmin) {
    tournamentsAdmin.open();
  }
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
    showStatus('Code administrateur incorrect.', true);
    return;
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

  await loadFighters();
  renderAdminList();
}

async function init() {
  setupTabs();
  setupEloCalculator();

  const savedPin = getPin();
  if (savedPin) {
    const valid = await verifyPin(savedPin);
    if (valid) {
      $('admin-auth').classList.add('hidden');
      $('admin-panel').classList.remove('hidden');
      if (!tournamentsAdmin) {
        tournamentsAdmin = initTournamentsAdmin({
          root: $('tournaments-root'),
          getPin,
          showStatus,
        });
      }
      await loadFighters();
      renderAdminList();
      return;
    }
    sessionStorage.removeItem(PIN_KEY);
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
