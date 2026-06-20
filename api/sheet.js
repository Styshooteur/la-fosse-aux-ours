import { SHEET_ID, SHEET_NAME } from './_lib/config.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const sheetUrl =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

  try {
    const response = await fetch(sheetUrl, { signal: AbortSignal.timeout(15000) });
    const text = await response.text();

    if (!response.ok) {
      return res.status(502).send(`Erreur Google Sheets (${response.status}).`);
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(text);
  } catch (error) {
    return res.status(502).send(`Erreur proxy Google Sheets: ${error.message}`);
  }
}
