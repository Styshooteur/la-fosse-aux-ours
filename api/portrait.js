import { head } from '@vercel/blob';
import { getBlobCallOptions } from './_lib/blob.js';

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
    const meta = await head(path, getBlobCallOptions());
    const sourceUrl = meta.downloadUrl || meta.url;
    const upstream = await fetch(sourceUrl);
    if (!upstream.ok) {
      return res.status(404).end();
    }

    res.setHeader('Content-Type', meta.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(buffer);
  } catch {
    return res.status(404).end();
  }
}
