import { verifyPin, getAdminPinFromRequest } from './_lib/admin.js';
import { formatStorageError } from './_lib/storage-error.js';
import { getArenaRules, saveArenaRules } from './_lib/arena-rules-store.js';

function isPublicRequest(req) {
  if (req.query?.scope === 'public') return true;
  const path = String(req.url || '').split('?')[0];
  return path.endsWith('/public');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (isPublicRequest(req)) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Méthode non autorisée.' });
    }

    try {
      const data = await getArenaRules();
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: formatStorageError(error) });
    }
  }

  try {
    if (req.method === 'GET') {
      const pin = getAdminPinFromRequest(req);
      if (!verifyPin(pin)) {
        return res.status(403).json({ error: 'Accès refusé.' });
      }
      const data = await getArenaRules();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const pin = getAdminPinFromRequest(req);
      if (!verifyPin(pin)) {
        return res.status(403).json({ error: 'Code administrateur incorrect.' });
      }

      const sections = req.body?.sections;
      if (!sections) {
        return res.status(400).json({ error: 'Contenu des règles manquant.' });
      }

      const saved = await saveArenaRules(sections);
      return res.status(200).json({ ok: true, ...saved });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  } catch (error) {
    const message = error.message || formatStorageError(error);
    const status = /invalide|manquant/i.test(message) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}
