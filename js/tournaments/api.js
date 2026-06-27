function adminHeaders(pin) {
  const headers = { 'Cache-Control': 'no-store' };
  if (pin) headers['X-Admin-Pin'] = pin;
  return headers;
}

export async function fetchTournaments(pin) {
  const response = await fetch('/api/tournaments', { headers: adminHeaders(pin) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Impossible de charger les tournois.');
  }
  const data = await response.json();
  return data.tournaments || [];
}

export async function fetchTournament(id, pin) {
  const response = await fetch(`/api/tournaments?id=${encodeURIComponent(id)}`, {
    headers: adminHeaders(pin),
  });
  if (!response.ok) throw new Error('Tournoi introuvable.');
  const data = await response.json();
  return data.tournament;
}

export async function saveTournament(tournament, pin) {
  const response = await fetch('/api/tournaments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders(pin) },
    body: JSON.stringify({ pin, tournament }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Échec de la sauvegarde.');
  return data.tournament || tournament;
}

export async function deleteTournament(id, pin) {
  const response = await fetch('/api/tournaments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders(pin) },
    body: JSON.stringify({ pin, action: 'delete', id }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Échec de la suppression.');
}
