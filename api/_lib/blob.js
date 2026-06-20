import { put } from '@vercel/blob';

/** Chemin API pour afficher un portrait stocké en Blob privé. */
export function portraitApiPath(blobPathname) {
  return `/api/portrait?path=${encodeURIComponent(blobPathname)}`;
}

/** Store Blob connecté au projet (OIDC ou token statique). */
export function isBlobConfigured() {
  return Boolean(
    process.env.BLOB_STORE_ID ||
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL_OIDC_TOKEN
  );
}

/**
 * Auth Blob pour @vercel/blob.
 * Sur Vercel, OIDC + BLOB_STORE_ID prime sur un token manuel (souvent périmé).
 */
export function getBlobCallOptions() {
  const storeId = process.env.BLOB_STORE_ID?.trim();

  if (storeId && process.env.VERCEL_OIDC_TOKEN) {
    return { storeId, oidcToken: process.env.VERCEL_OIDC_TOKEN };
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) {
    return { token };
  }

  if (storeId) {
    return { storeId };
  }

  return {};
}

/** Mode d'accès du store — public par défaut (store actuel du projet). */
export function getBlobAccess() {
  const mode = process.env.BLOB_ACCESS?.trim().toLowerCase();
  return mode === 'private' ? 'private' : 'public';
}

/** Upload Blob avec le bon mode d'accès (sans retry ambigu). */
export async function putBlob(pathname, body, contentType) {
  const access = getBlobAccess();

  const blob = await put(pathname, body, {
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    ...getBlobCallOptions(),
    access,
  });

  return { blob, access };
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
      'Variables d\'environnement (Production) → redéployez. ' +
      'Ou supprimez BLOB_READ_WRITE_TOKEN si le store est connecté via OIDC.'
    );
  }
  return (
    'Connectez un store Vercel Blob public au projet la-fosse-aux-ours-lvza, ' +
    'vérifiez BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN, puis redéployez.'
  );
}
