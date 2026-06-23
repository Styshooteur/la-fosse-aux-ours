import { getFightersMap, listCustomPortraitNames } from './_lib/fighters-store.js';
import { formatStorageError } from './_lib/storage-error.js';

export default async function handler(_req, res) {
  try {
    const [fighters, customPortraits] = await Promise.all([
      getFightersMap(),
      listCustomPortraitNames(),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ fighters, customPortraits });
  } catch (error) {
    return res.status(500).json({ error: formatStorageError(error) });
  }
}
