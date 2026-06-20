/** Options d'authentification pour @vercel/blob (token ou OIDC). */
export function getBlobCallOptions() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return { token: process.env.BLOB_READ_WRITE_TOKEN };
  }

  if (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID) {
    return {
      oidcToken: process.env.VERCEL_OIDC_TOKEN,
      storeId: process.env.BLOB_STORE_ID,
    };
  }

  return null;
}

export function isBlobConfigured() {
  return getBlobCallOptions() !== null;
}

export function requireBlobOptions() {
  const options = getBlobCallOptions();
  if (!options) {
    throw new Error(
      'Blob non configuré : ajoutez BLOB_READ_WRITE_TOKEN dans les variables Vercel (Storage → votre Blob → onglet .env.local), puis redéployez.'
    );
  }
  return options;
}
