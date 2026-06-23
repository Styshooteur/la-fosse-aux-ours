import { verifyPin } from '../_lib/admin.js';
import { formatBlobError } from '../_lib/blob.js';
import {
  deleteTournament,
  getTournament,
  listTournaments,
  saveTournament,
} from '../_lib/tournaments-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const { id } = req.query;
      if (id) {
        const tournament = await getTournament(id);
        if (!tournament || tournament.deleted) {
          return res.status(404).json({ error: 'Tournoi introuvable.' });
        }
        return res.status(200).json({ tournament });
      }

      const tournaments = await listTournaments();
      return res.status(200).json({ tournaments });
    }

    if (req.method === 'POST') {
      const pin = req.body?.pin || '';
      if (!verifyPin(pin)) {
        return res.status(403).json({ error: 'Code administrateur incorrect.' });
      }

      const action = req.body?.action || 'save';

      if (action === 'delete') {
        const id = req.body?.id;
        if (!id) return res.status(400).json({ error: 'ID manquant.' });
        await deleteTournament(id);
        return res.status(200).json({ ok: true });
      }

      const tournament = req.body?.tournament;
      if (!tournament?.id) {
        return res.status(400).json({ error: 'Données de tournoi invalides.' });
      }

      await saveTournament(tournament);
      return res.status(200).json({ ok: true, tournament });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  } catch (error) {
    return res.status(500).json({ error: formatBlobError(error) });
  }
}
