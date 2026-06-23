import { listLiveTournamentsFull } from '../_lib/tournaments-store.js';
import { formatStorageError } from '../_lib/storage-error.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    const tournaments = await listLiveTournamentsFull();
    return res.status(200).json({ tournaments });
  } catch (error) {
    return res.status(500).json({ error: formatStorageError(error) });
  }
}
