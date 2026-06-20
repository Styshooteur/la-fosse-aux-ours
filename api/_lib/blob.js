/** Vercel Blob : token classique ou connexion OIDC (BLOB_STORE_ID). */
export function isBlobConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_STORE_ID ||
      process.env.VERCEL_OIDC_TOKEN
  );
}
