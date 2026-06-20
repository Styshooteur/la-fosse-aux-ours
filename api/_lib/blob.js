/** Options d'authentification pour @vercel/blob (OIDC prioritaire sur Vercel). */
export function getBlobCallOptions() {
  if (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID) {
    return {
      oidcToken: process.env.VERCEL_OIDC_TOKEN,
      storeId: process.env.BLOB_STORE_ID,
    };
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return { token: process.env.BLOB_READ_WRITE_TOKEN };
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
      'Blob non configuré : connectez le store Blob au projet et redéployez, ou ajoutez un BLOB_READ_WRITE_TOKEN valide.'
    );
  }
  return options;
}
