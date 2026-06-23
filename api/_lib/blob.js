import { get, put } from '@vercel/blob';

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
 * Identifiants pour parler à Vercel Blob.
 * Sur Vercel, on utilise la connexion automatique du projet (OIDC).
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

const forcedAccess = process.env.BLOB_ACCESS?.trim().toLowerCase();
/** Évite 2 lectures par fichier (private puis public) une fois le mode connu. */
let cachedReadAccess =
  forcedAccess === 'private' || forcedAccess === 'public' ? forcedAccess : null;

function isWrongAccessMode(message, attemptedAccess) {
  const msg = message.toLowerCase();
  if (attemptedAccess === 'public') {
    return msg.includes('private store') || msg.includes('cannot use public');
  }
  if (attemptedAccess === 'private') {
    return (
      msg.includes('must be "public"') ||
      msg.includes('cannot use private') ||
      (msg.includes('access must be') && msg.includes('public'))
    );
  }
  return false;
}

/**
 * Upload — détecte automatiquement si le store est privé ou public.
 * Aucun réglage manuel requis de votre part.
 */
export async function putBlob(pathname, body, contentType) {
  const base = {
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    ...getBlobCallOptions(),
  };

  const modes = cachedReadAccess
    ? [cachedReadAccess]
    : forcedAccess === 'private' || forcedAccess === 'public'
      ? [forcedAccess]
      : ['private', 'public'];

  let lastError = null;
  for (const access of modes) {
    try {
      const blob = await put(pathname, body, { ...base, access });
      if (!cachedReadAccess) cachedReadAccess = access;
      return { blob, access };
    } catch (error) {
      lastError = error;
      if (isWrongAccessMode(error.message || '', access)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Impossible de joindre le stockage Vercel Blob.');
}

/** URL affichable sur le site selon le mode du store. */
export function imageUrlForBlob(blob, pathname, access) {
  if (access === 'private') {
    return portraitApiPath(pathname);
  }
  return blob.url;
}

/** Lit un fichier Blob (store privé ou public). */
export async function readBlobContent(pathname) {
  const modes = cachedReadAccess
    ? [cachedReadAccess]
    : forcedAccess === 'private' || forcedAccess === 'public'
      ? [forcedAccess]
      : ['private', 'public'];

  for (const access of modes) {
    try {
      const result = await get(pathname, {
        access,
        useCache: false,
        ...getBlobCallOptions(),
      });
      if (!result?.stream) {
        continue;
      }

      if (!cachedReadAccess) cachedReadAccess = access;

      const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
      return {
        buffer,
        contentType: result.blob?.contentType || 'application/octet-stream',
      };
    } catch (error) {
      if (isWrongAccessMode(error.message || '', access)) {
        continue;
      }
      throw error;
    }
  }

  return null;
}

/** Lit un JSON stocké dans Blob. */
export async function readBlobJson(pathname) {
  const content = await readBlobContent(pathname);
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content.buffer.toString('utf-8'));
  } catch {
    return null;
  }
}

export function blobSetupHint() {
  return (
    'Le stockage d\'images (Vercel Blob) n\'est pas correctement connecté au site. ' +
    'Sur vercel.com → projet la-fosse-aux-ours-lvza → Storage → vérifiez que le Blob est bien connecté, puis redéployez.'
  );
}

/** Message en français pour les erreurs Vercel Blob courantes. */
export function formatBlobError(error) {
  const msg = error?.message || String(error || '');
  if (/suspended/i.test(msg)) {
    return (
      'Le stockage Vercel Blob est suspendu sur votre compte. ' +
      'Allez sur vercel.com → Storage → ouvrez votre Blob store et réactivez-le (ou vérifiez la facturation). ' +
      'En attendant, vous pouvez utiliser le site en local avec start.bat.'
    );
  }
  if (/not found|does not exist/i.test(msg)) {
    return blobSetupHint();
  }
  return msg || 'Erreur de stockage Vercel Blob.';
}
