import { verifyPin, getAdminPinFromRequest } from '../_lib/admin.js';
import { formatStorageError } from '../_lib/storage-error.js';
import { getOpeningHours, saveOpeningHours } from '../_lib/opening-hours-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const pin = getAdminPinFromRequest(req);
      if (!verifyPin(pin)) {
        return res.status(403).json({ error: 'Accès refusé.' });
      }
      const data = await getOpeningHours();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const pin = getAdminPinFromRequest(req);
      if (!verifyPin(pin)) {
        return res.status(403).json({ error: 'Code administrateur incorrect.' });
      }

      const schedule = req.body?.schedule;
      if (!schedule) {
        return res.status(400).json({ error: 'Horaires manquants.' });
      }

      const saved = await saveOpeningHours(schedule);
      return res.status(200).json({ ok: true, ...saved });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  } catch (error) {
    const message = error.message || formatStorageError(error);
    const status = /invalide|requise|manquant/i.test(message) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}
