export const SHEET_ID = process.env.SHEET_ID || '1o9A924ybUdpSoM9AQ6nOeyuft6lytrgXG3pIKFLXvBk';
export const SHEET_NAME = process.env.SHEET_NAME || 'Feuille 1';
export const FIGHTERS_REGISTRY_BLOB = 'data/fighters-registry.json';
export const TOURNAMENTS_INDEX_BLOB = 'data/tournaments-index.json';

export function tournamentBlobPath(id) {
  return `data/tournaments/${id}.json`;
}
