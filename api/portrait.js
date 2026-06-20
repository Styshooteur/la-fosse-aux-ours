import { readBlobContent } from './_lib/blob.js';

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
    const content = await readBlobContent(path);
    if (!content) {
      return res.status(404).end();
    }

    res.setHeader('Content-Type', content.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(content.buffer);
  } catch {
    return res.status(404).end();
  }
}
