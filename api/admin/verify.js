import { verifyPin } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const pin = req.body?.pin || '';
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ valid: verifyPin(pin) });
}
