import { renderLiveEventsPage } from './tournaments/render-public.js';
import { liveTournamentsSignature } from './tournaments/live-sync.js';

const POLL_MS = 1500;
const RECONNECT_MS = 3000;

let stream = null;
let pollTimer = null;
let reconnectTimer = null;
let lastSig = '';
let connectionState = 'connecting';

const $ = (id) => document.getElementById(id);

function setConnectionState(state) {
  connectionState = state;
  const el = $('live-connection-status');
  if (!el) return;
  if (state === 'connected') {
    el.classList.add('hidden');
    el.textContent = '';
  } else if (state === 'reconnecting') {
    el.textContent = 'Reconnexion…';
    el.classList.remove('hidden');
  } else if (state === 'connecting') {
    el.textContent = 'Connexion…';
    el.classList.remove('hidden');
  }
}

function applyTournaments(tournaments) {
  const container = $('live-events-root');
  if (!container) return;

  const sig = liveTournamentsSignature(tournaments);
  if (sig === lastSig) return;
  lastSig = sig;

  container.innerHTML = renderLiveEventsPage(tournaments);
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
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const tournaments = await fetchLiveTournaments();
      applyTournaments(tournaments);
      setConnectionState('connected');
    } catch {
      setConnectionState('reconnecting');
    }
  }, POLL_MS);
}

function stopStream() {
  if (stream) {
    stream.close();
    stream = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  setConnectionState('reconnecting');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectLiveStream();
  }, RECONNECT_MS);
}

function connectLiveStream() {
  stopStream();
  setConnectionState('connecting');

  if (typeof EventSource === 'undefined') {
    startPolling();
    return;
  }

  try {
    stream = new EventSource('/api/tournaments/stream');

    stream.onopen = () => {
      setConnectionState('connected');
      stopPolling();
    };

    stream.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        applyTournaments(data.tournaments || []);
        setConnectionState('connected');
      } catch {
        /* ignore malformed payloads */
      }
    };

    stream.onerror = () => {
      stopStream();
      startPolling();
      scheduleReconnect();
    };
  } catch {
    startPolling();
    scheduleReconnect();
  }
}

export async function initLiveEvents() {
  const container = $('live-events-root');
  if (!container) return;

  try {
    const tournaments = await fetchLiveTournaments();
    applyTournaments(tournaments);
  } catch {
    container.innerHTML =
      '<p class="live-events-empty">Impossible de charger les événements pour le moment.</p>';
  }

  connectLiveStream();
}

export function teardownLiveEvents() {
  stopStream();
  stopPolling();
  lastSig = '';
}
