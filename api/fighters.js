import { getFightersMap } from './_lib/fighters-store.js';

export default async function handler(_req, res) {
  try {
    const fighters = await getFightersMap();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ fighters });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
