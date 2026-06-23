import { renderLiveEventsPage } from './tournaments/render-public.js';
import { liveTournamentsSignature } from './tournaments/live-sync.js';

/** Intervalle entre actualisations automatiques (onglet visible). */
const POLL_MS = 120_000;
/** SSE uniquement en dev local (server.py) — pas de quota Blob/Supabase en boucle. */
const SSE_ENABLED = ['localhost', '127.0.0.1'].includes(location.hostname);

let stream = null;
let pollTimer = null;
let lastSig = '';

const $ = (id) => document.getElementById(id);

function setStatus(text, visible) {
  const el = $('live-connection-status');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('hidden', !visible);
}

function applyTournaments(tournaments) {
  const container = $('live-events-root');
  if (!container) return;

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

async function fetchLiveTournaments() {
  const res = await fetch('/api/tournaments/public', { cache: 'no-store' });
  if (!res.ok) throw new Error('Impossible de charger les événements.');
  const data = await res.json();
  return data.tournaments || [];
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

export async function initLiveEvents() {
  const container = $('live-events-root');
  if (!container) return;

  const refreshBtn = $('live-events-refresh');
  refreshBtn?.addEventListener('click', () => refreshLiveEvents());

  try {
    applyTournaments(await fetchLiveTournaments());
  } catch {
    container.innerHTML =
      '<p class="live-events-empty">Impossible de charger les événements pour le moment.</p>';
  }

  if (SSE_ENABLED) {
    connectLocalStream();
  } else {
    startPolling();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
}

export function teardownLiveEvents() {
  stopStream();
  stopPolling();
  document.removeEventListener('visibilitychange', onVisibilityChange);
  lastSig = '';
}
