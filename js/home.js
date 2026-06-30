import {
  WEEKDAYS,
  cloneSchedule,
  defaultSchedule,
  formatDaySlots,
  isArenaOpenNow,
} from './opening-hours/schedule.js?v=20260630a';

const POLL_MS = 60_000;

let schedule = defaultSchedule();
let panelActive = false;
let statusTimer = null;
let scheduleTimer = null;
let lastUpdatedAt = null;

const $ = (id) => document.getElementById(id);

function setStatusOpen(isOpen) {
  const el = $('arena-status');
  if (!el) return;
  el.textContent = isOpen ? 'ARÈNE OUVERTE' : 'ARÈNE FERMÉE';
  el.classList.toggle('home-status--open', isOpen);
  el.classList.toggle('home-status--closed', !isOpen);
}

function renderHoursList() {
  const list = $('home-hours-list');
  if (!list) return;

  list.innerHTML = WEEKDAYS.map(
    ({ key, label }) => `
    <div class="home-hours-row">
      <dt class="home-hours-day">${label}</dt>
      <dd class="home-hours-times">${formatDaySlots(schedule[key])}</dd>
    </div>`
  ).join('');
}

function updateLiveStatus() {
  setStatusOpen(isArenaOpenNow(schedule));
}

async function fetchSchedule() {
  const res = await fetch('/api/opening-hours/public', { cache: 'no-store' });
  if (!res.ok) throw new Error('Impossible de charger les horaires.');
  const data = await res.json();
  return data;
}

async function refreshSchedule({ force = false } = {}) {
  try {
    const data = await fetchSchedule();
    const updatedAt = data.updatedAt || null;
    if (!force && updatedAt && updatedAt === lastUpdatedAt) return;
    lastUpdatedAt = updatedAt;
    schedule = cloneSchedule(data.schedule || defaultSchedule());
    renderHoursList();
    updateLiveStatus();
  } catch (err) {
    console.error('Erreur chargement horaires', err);
    const list = $('home-hours-list');
    if (list && panelActive) {
      list.innerHTML =
        '<p class="home-hours-error">Impossible de charger les horaires pour le moment.</p>';
    }
  }
}

function startTimers() {
  stopTimers();
  statusTimer = setInterval(updateLiveStatus, POLL_MS);
  scheduleTimer = setInterval(() => refreshSchedule(), POLL_MS);
}

function stopTimers() {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
  if (scheduleTimer) {
    clearInterval(scheduleTimer);
    scheduleTimer = null;
  }
}

export function activateHomePanel() {
  panelActive = true;
  lastUpdatedAt = null;
  refreshSchedule({ force: true });
  startTimers();
}

export function deactivateHomePanel() {
  panelActive = false;
  stopTimers();
}

export async function initHome() {
  try {
    await refreshSchedule({ force: true });
  } catch {
    /* affiché à l'activation du panneau */
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && panelActive) {
      refreshSchedule({ force: true });
      updateLiveStatus();
      startTimers();
    } else if (document.visibilityState !== 'visible') {
      stopTimers();
    }
  });
}
