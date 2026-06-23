import { verifyPin } from '../_lib/admin.js';
import { deleteFighterPortrait } from '../_lib/fighters-store.js';
import { formatStorageError } from '../_lib/storage-error.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const pin = req.body?.pin || '';
  if (!verifyPin(pin)) {
    return res.status(403).json({ error: 'Code administrateur incorrect.' });
  }

  const fighterName = (req.body?.fighterName || '').trim();
  if (!fighterName) {
    return res.status(400).json({ error: 'Nom du combattant manquant.' });
  }

  try {
    await deleteFighterPortrait(fighterName);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: formatStorageError(error) });
  }
}
