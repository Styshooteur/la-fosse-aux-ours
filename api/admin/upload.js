import { verifyPin } from '../_lib/admin.js';
import { saveFighterPortrait } from '../_lib/fighters-store.js';
import {
  isPortraitsStorageConfigured,
  portraitsSetupHint,
  uploadPortraitFile,
} from '../_lib/portraits-storage.js';
import { slugify } from '../_lib/slugify.js';
import { formatStorageError } from '../_lib/storage-error.js';
import {
  assertImageMagicBytes,
  assertImageSize,
  MAX_IMAGE_BASE64_CHARS,
} from '../_lib/image-validate.js';

export default async function handler(req, res) {
  try {
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
    if (fighterName.length > 120) {
      return res.status(400).json({ error: 'Nom du combattant trop long.' });
    }

    const match = /^data:image\/(\w+);base64,(.+)$/.exec(imageData);
    if (!match) {
      return res.status(400).json({ error: 'Image invalide.' });
    }

    if (match[2].length > MAX_IMAGE_BASE64_CHARS) {
      return res.status(400).json({ error: 'Image trop lourde (max 5 Mo).' });
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

    try {
      assertImageSize(binary);
      assertImageMagicBytes(binary, ext);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!isPortraitsStorageConfigured()) {
      return res.status(503).json({ error: portraitsSetupHint() });
    }

    const storagePath = `fighters/${slugify(fighterName)}.${ext}`;
    const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const imageUrl = await uploadPortraitFile(storagePath, binary, contentType);

    await saveFighterPortrait(fighterName, imageUrl, storagePath);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, image: imageUrl });
  } catch (error) {
    return res.status(500).json({ error: formatStorageError(error) });
  }
}
