/** Signature légère pour détecter les changements côté client. */
export function liveTournamentsSignature(tournaments) {
  return tournaments
    .map((t) => `${t.id}:${t.updatedAt}:${Boolean(t.broadcast)}`)
    .sort()
    .join('|');
}
