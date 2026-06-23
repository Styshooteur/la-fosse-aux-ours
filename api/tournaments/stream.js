import {
  getLiveTournamentsRevision,
  listLiveTournamentsFull,
} from '../_lib/tournaments-store.js';

/** SSE temps réel — utilisé uniquement en local (server.py). Le site public en prod utilise un poll 60 s. */
const STREAM_INTERVAL_MS = 3000;

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  } else {
    res.writeHead(200);
  }

  let lastSig = null;
  let closed = false;

  const tick = async () => {
    if (closed) return;
    try {
      const sig = await getLiveTournamentsRevision();
      if (sig !== lastSig) {
        const tournaments = sig ? await listLiveTournamentsFull() : [];
        res.write(`data: ${JSON.stringify({ tournaments })}\n\n`);
        lastSig = sig;
      } else {
        res.write(': heartbeat\n\n');
      }
    } catch (error) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
    }
  };

  await tick();
  const interval = setInterval(tick, STREAM_INTERVAL_MS);

  req.on('close', () => {
    closed = true;
    clearInterval(interval);
  });
}
