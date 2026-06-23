import { readBlobContent, isBlobConfigured } from './_lib/blob.js';
import {
  downloadPortraitFile,
  isPortraitsStorageConfigured,
} from './_lib/portraits-storage.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const path = req.query.path;
  if (!path || typeof path !== 'string' || path.includes('..')) {
    return res.status(400).end();
  }

  try {
    if (isPortraitsStorageConfigured()) {
      const content = await downloadPortraitFile(path);
      res.setHeader('Content-Type', content.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(content.buffer);
    }

    if (isBlobConfigured()) {
      const content = await readBlobContent(path);
      if (content) {
        res.setHeader('Content-Type', content.contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(content.buffer);
      }
    }

    return res.status(404).end();
  } catch {
    return res.status(404).end();
  }
}
