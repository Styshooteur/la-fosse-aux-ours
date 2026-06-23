import { formatBlobError } from './blob.js';
import { portraitsSetupHint } from './portraits-storage.js';

/** Message d'erreur lisible pour les API de stockage (Supabase, Blob legacy). */
export function formatStorageError(error) {
  const msg = error?.message || String(error || '');
  if (/supabase|stockage tournois|fighter_portraits|portraits non configuré/i.test(msg)) {
    return msg;
  }
  if (/bucket not found|storage/i.test(msg)) {
    return `${msg} — ${portraitsSetupHint()}`;
  }
  return formatBlobError(error);
}
