import { renderLiveEventsPage } from './tournaments/render-public.js';
import { liveTournamentsSignature } from './tournaments/live-sync.js';

/** Intervalle entre actualisations automatiques (onglet visible). */
const POLL_MS = 120_000;
/** SSE uniquement en dev local (server.py) — pas de quota Blob/Supabase en boucle. */
const SSE_ENABLED = ['localhost', '127.0.0.1'].includes(location.hostname);

let stream = null;
let pollTimer = null;
let lastSig = '';
let lastHasLive = null;
let panelActive = false;
let navStarted = false;
let cachedTournaments = [];
let inFlightFetch = null;

const $ = (id) => document.getElementById(id);

function setStatus(text, visible) {
  const el = $('live-connection-status');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('hidden', !visible);
}

function setLiveNavIndicator(hasLive) {
  if (hasLive === lastHasLive) return;
  lastHasLive = hasLive;

  const icon = $('nav-events-live-icon');
  const nav = $('nav-events');
  if (icon) {
    icon.classList.toggle('hidden', !hasLive);
    icon.hidden = !hasLive;
  }
  nav?.classList.toggle('site-nav-btn--live', hasLive);
}

function renderPanelContent(tournaments) {
  const container = $('live-events-root');
  if (!container || !panelActive) return;

  const sig = liveTournamentsSignature(tournaments);
  if (sig === lastSig) return;
  lastSig = sig;

  try {
    container.innerHTML = renderLiveEventsPage(tournaments);
  } catch (err) {
    console.error('Erreur affichage événements', err);
    container.innerHTML =
      '<p class="live-events-empty">Impossible d\'afficher les événements pour le moment.</p>';
  }
}

function applyTournaments(tournaments) {
  cachedTournaments = tournaments;
  setLiveNavIndicator(tournaments.length > 0);
  renderPanelContent(tournaments);
}

async function fetchLiveTournaments() {
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = (async () => {
    const res = await fetch('/api/tournaments/public', { cache: 'no-store' });
    if (!res.ok) throw new Error('Impossible de charger les événements.');
    const data = await res.json();
    return data.tournaments || [];
  })();

  try {
    return await inFlightFetch;
  } finally {
    inFlightFetch = null;
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling() {
  if (pollTimer || document.visibilityState !== 'visible') return;
  pollTimer = setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      applyTournaments(await fetchLiveTournaments());
      setStatus('', false);
    } catch {
      setStatus('Actualisation impossible — réessayez.', true);
    }
  }, POLL_MS);
}

function stopStream() {
  if (stream) {
    stream.close();
    stream = null;
  }
}

function connectLocalStream() {
  if (!SSE_ENABLED || typeof EventSource === 'undefined') return;

  stopStream();
  try {
    stream = new EventSource('/api/tournaments/stream');
    stream.onopen = () => setStatus('', false);
    stream.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        applyTournaments(data.tournaments || []);
        setStatus('', false);
      } catch {
        /* ignore */
      }
    };
    stream.onerror = () => {
      stopStream();
      startPolling();
    };
  } catch {
    startPolling();
  }
}

export async function refreshLiveEvents() {
  const btn = $('live-events-refresh');
  if (btn) btn.disabled = true;

  try {
    applyTournaments(await fetchLiveTournaments());
    setStatus('Mis à jour à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), true);
    setTimeout(() => setStatus('', false), 2500);
  } catch {
    setStatus('Impossible de charger les événements.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    refreshLiveEvents();
    if (!SSE_ENABLED) startPolling();
  } else {
    stopPolling();
  }
}

/** Indicateur nav + polling léger — démarré au chargement du site. */
export async function initLiveEventsNav() {
  if (navStarted) return;
  navStarted = true;

  try {
    applyTournaments(await fetchLiveTournaments());
  } catch (err) {
    console.error('Erreur chargement indicateur événements', err);
  }

  if (SSE_ENABLED) {
    connectLocalStream();
  } else {
    startPolling();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
}

/** Affiche le panneau événements (réutilise le cache, pas de requête supplémentaire). */
export function activateLiveEventsPanel() {
  panelActive = true;
  const container = $('live-events-root');
  if (!container) return;

  if (lastHasLive === null) {
    container.innerHTML = '<p class="live-events-empty">Chargement des événements…</p>';
    return;
  }

  lastSig = '';
  renderPanelContent(cachedTournaments);
}

export function deactivateLiveEventsPanel() {
  panelActive = false;
}

export function teardownLiveEvents() {
  stopStream();
  stopPolling();
  document.removeEventListener('visibilitychange', onVisibilityChange);
  navStarted = false;
  panelActive = false;
  lastSig = '';
  lastHasLive = null;
  cachedTournaments = [];
}
