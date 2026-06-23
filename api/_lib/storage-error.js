import { formatBlobError } from './blob.js';

/** Message d'erreur lisible pour les API de stockage (Supabase, Blob, local). */
export function formatStorageError(error) {
  const msg = error?.message || String(error || '');
  if (/supabase|stockage tournois/i.test(msg)) {
    return msg;
  }
  return formatBlobError(error);
}
