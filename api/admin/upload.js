import { put } from '@vercel/blob';
import { verifyPin } from '../_lib/admin.js';
import { isBlobConfigured, requireBlobOptions } from '../_lib/blob.js';
import { saveFighterPortrait } from '../_lib/fighters-store.js';
import { slugify } from '../_lib/slugify.js';

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
  const imageData = req.body?.imageData || '';

  if (!fighterName) {
    return res.status(400).json({ error: 'Nom du combattant manquant.' });
  }

  const match = /^data:image\/(\w+);base64,(.+)$/.exec(imageData);
  if (!match) {
    return res.status(400).json({ error: 'Image invalide.' });
  }

  let ext = match[1].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (!['png', 'jpg', 'webp', 'gif'].includes(ext)) {
    return res.status(400).json({ error: 'Format non supporté (PNG, JPG, WEBP, GIF).' });
  }

  let binary;
  try {
    binary = Buffer.from(match[2], 'base64');
  } catch {
    return res.status(400).json({ error: "Impossible de décoder l'image." });
  }

  if (!isBlobConfigured()) {
    return res.status(503).json({
      error:
        'Upload indisponible : ajoutez BLOB_READ_WRITE_TOKEN dans Vercel (Storage → Blob → .env.local), puis redéployez.',
    });
  }

  try {
    const blobOpts = requireBlobOptions();
    const filename = `fighters/${slugify(fighterName)}.${ext}`;
    const blob = await put(filename, binary, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      ...blobOpts,
    });

    await saveFighterPortrait(fighterName, blob.url);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, image: blob.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
