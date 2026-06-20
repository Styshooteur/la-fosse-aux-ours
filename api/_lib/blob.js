import { put } from '@vercel/blob';

/** Chemin API pour afficher un portrait stocké en Blob privé. */
export function portraitApiPath(blobPathname) {
  return `/api/portrait?path=${encodeURIComponent(blobPathname)}`;
}

/** Store Blob connecté au projet (OIDC ou token statique). */
export function isBlobConfigured() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

/** Options passées à @vercel/blob — token valide prioritaire, sinon OIDC du store. */
export function getBlobCallOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) {
    return { token };
  }

  const storeId = process.env.BLOB_STORE_ID;
  if (!storeId) {
    return {};
  }

  const opts = { storeId };
  if (process.env.VERCEL_OIDC_TOKEN) {
    opts.oidcToken = process.env.VERCEL_OIDC_TOKEN;
  }
  return opts;
}

/** Upload Blob — essaie public puis private selon la config du store. */
export async function putBlob(pathname, body, contentType) {
  const base = {
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    ...getBlobCallOptions(),
  };

  let lastError = null;
  for (const access of ['public', 'private']) {
    try {
      const blob = await put(pathname, body, { ...base, access });
      return { blob, access };
    } catch (error) {
      lastError = error;
      const msg = error.message || '';
      if (/access must be|private store|public access|cannot use public/i.test(msg)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Impossible de joindre le store Vercel Blob.');
}

/** URL affichable sur le site selon le mode du store. */
export function imageUrlForBlob(blob, pathname, access) {
  if (access === 'private') {
    return portraitApiPath(pathname);
  }
  return blob.url;
}

export function blobSetupHint() {
  if (process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    return (
      'Le store Blob est connecté mais l\'authentification a échoué. ' +
      'Storage → votre Blob → onglet .env.local → copiez BLOB_READ_WRITE_TOKEN → ' +
      'Variables d\'environnement (Production) → redéployez.'
    );
  }
  return (
    'Connectez un store Vercel Blob au projet la-fosse-aux-ours-lvza, ' +
    'ajoutez BLOB_READ_WRITE_TOKEN, puis redéployez.'
  );
}
