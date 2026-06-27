import { verifyPin } from '../_lib/admin.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    const pin = req.body?.pin || '';
    return res.status(200).json({ valid: verifyPin(pin) });
  } catch {
    return res.status(400).json({ valid: false, error: 'Requête invalide.' });
  }
}
