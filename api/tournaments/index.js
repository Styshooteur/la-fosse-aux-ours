import { verifyPin, getAdminPinFromRequest } from '../_lib/admin.js';
import { formatStorageError } from '../_lib/storage-error.js';
import {
  deleteTournament,
  getTournament,
  listTournaments,
  saveTournament,
} from '../_lib/tournaments-store.js';
import {
  sanitizeTournamentPayload,
  validateTournamentId,
} from '../_lib/tournament-validate.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const pin = getAdminPinFromRequest(req);
      const isAdmin = verifyPin(pin);
      const { id } = req.query;

      if (id) {
        validateTournamentId(id);
        const tournament = await getTournament(id);
        if (!tournament || tournament.deleted) {
          return res.status(404).json({ error: 'Tournoi introuvable.' });
        }
        if (!isAdmin && !tournament.broadcast) {
          return res.status(404).json({ error: 'Tournoi introuvable.' });
        }
        return res.status(200).json({ tournament });
      }

      if (!isAdmin) {
        return res.status(403).json({ error: 'Accès refusé.' });
      }

      const tournaments = await listTournaments();
      return res.status(200).json({ tournaments });
    }

    if (req.method === 'POST') {
      const pin = getAdminPinFromRequest(req);
      if (!verifyPin(pin)) {
        return res.status(403).json({ error: 'Code administrateur incorrect.' });
      }

      const action = req.body?.action || 'save';

      if (action === 'delete') {
        const id = req.body?.id;
        if (!id) return res.status(400).json({ error: 'ID manquant.' });
        validateTournamentId(id);
        await deleteTournament(id);
        return res.status(200).json({ ok: true });
      }

      const tournament = req.body?.tournament;
      if (!tournament?.id) {
        return res.status(400).json({ error: 'Données de tournoi invalides.' });
      }

      sanitizeTournamentPayload(tournament);
      await saveTournament(tournament);
      return res.status(200).json({ ok: true, tournament });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  } catch (error) {
    const message = error.message || formatStorageError(error);
    const status = /invalide|requis|trop|reconnu/i.test(message) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}
