export async function fetchTournaments() {
  const response = await fetch('/api/tournaments');
  if (!response.ok) throw new Error('Impossible de charger les tournois.');
  const data = await response.json();
  return data.tournaments || [];
}

export async function fetchTournament(id) {
  const response = await fetch(`/api/tournaments?id=${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error('Tournoi introuvable.');
  const data = await response.json();
  return data.tournament;
}

export async function saveTournament(tournament, pin) {
  const response = await fetch('/api/tournaments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, tournament }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Échec de la sauvegarde.');
  return data.tournament || tournament;
}

export async function deleteTournament(id, pin) {
  const response = await fetch('/api/tournaments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, action: 'delete', id }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Échec de la suppression.');
}
