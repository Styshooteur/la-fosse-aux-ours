import {
  listLiveTournamentsFull,
  liveTournamentsSignature,
} from '../_lib/tournaments-store.js';

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

  let lastSig = '';
  let closed = false;

  const tick = async () => {
    if (closed) return;
    try {
      const tournaments = await listLiveTournamentsFull();
      const sig = liveTournamentsSignature(tournaments);
      if (sig !== lastSig) {
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
  const interval = setInterval(tick, 1500);

  req.on('close', () => {
    closed = true;
    clearInterval(interval);
  });
}
