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
