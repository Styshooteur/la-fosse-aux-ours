import { CONFIG } from './config.js';

const GRADE_SLUG_MAP = {
  "Honte de l'Arène": 'grade-honte-de-l-arene',
  'Novice': 'grade-novice',
  'Sang-Frais': 'grade-sang-frais',
  'Aspirant': 'grade-aspirant',
  'Combattant': 'grade-combattant',
  'Bretteur': 'grade-bretteur',
  'Duelliste': 'grade-duelliste',
  'Gladiateur': 'grade-gladiateur',
  'Maître de Duel': 'grade-maitre-de-duel',
  "Maître d'Armes": 'grade-maitre-d-armes',
  "Favori d'Estemarche": 'grade-favori-d-estemarche',
  "Ours d'Estemarche": 'grade-ours-d-estemarche',
  "Champion d'Estemarche": 'grade-champion-d-estemarche',
  "Grand Champion d'Estemarche": 'grade-grand-champion-d-estemarche',
  "Légende d'Estemarche": 'grade-legende-d-estemarche',
};

export const GRADE_COLORS = {
  "Honte de l'Arène": '#3b3f40',
  'Novice': '#495052',
  'Sang-Frais': '#677578',
  'Aspirant': '#78551d',
  'Combattant': '#8f6118',
  'Bretteur': '#94600d',
  'Duelliste': '#9fb5b1',
  'Gladiateur': '#abd1ca',
  'Maître de Duel': '#c49d10',
  "Maître d'Armes": '#edbb07',
  "Favori d'Estemarche": '#de560d',
  "Ours d'Estemarche": '#bf280d',
  "Champion d'Estemarche": '#2f9656',
  "Grand Champion d'Estemarche": '#21b058',
  "Légende d'Estemarche": '#3bed7f',
};

export function gradeToClass(grade) {
  return GRADE_SLUG_MAP[grade] || 'grade-novice';
}

export function gradeToColor(grade) {
  return GRADE_COLORS[grade] || GRADE_COLORS.Novice;
}

function parseGvizResponse(text) {
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Réponse Google Sheets invalide.');
  }
  return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
}

function cellValue(cell) {
  if (!cell) return null;
  if (cell.f !== undefined && cell.f !== null && cell.f !== '') return cell.f;
  return cell.v ?? null;
}

function isFighterRow(cells) {
  const rank = cellValue(cells[0]);
  const name = cellValue(cells[2]);
  return rank !== null && name !== null && String(name).trim() !== '';
}

export async function fetchLeaderboard() {
  const directUrl = new URL(`https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq`);
  directUrl.searchParams.set('tqx', 'out:json');
  directUrl.searchParams.set('sheet', CONFIG.sheetName);

  const urls = [CONFIG.sheetApiUrl, directUrl.toString()].filter(Boolean);
  let lastError = null;

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Impossible de joindre le registre (${response.status}).`);
      }

      const text = await response.text();
      const data = parseGvizResponse(text);

      if (data.status !== 'ok') {
        throw new Error('Le registre a renvoyé une erreur.');
      }

      return parseLeaderboardData(data);
    } catch (err) {
      if (err.name === 'AbortError') {
        lastError = new Error('Délai dépassé en attendant le registre.');
      } else {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Impossible de charger le classement.');
}

function parseLeaderboardData(data) {
  const rows = data.table.rows;
  const fighters = [];
  const stats = {};
  const gradeLegend = [];

  for (const row of rows) {
    const cells = row.c;
    if (!cells) continue;

    if (isFighterRow(cells)) {
      fighters.push({
        rang: cellValue(cells[0]),
        grade: cellValue(cells[1]),
        combattant: cellValue(cells[2]),
        points: cellValue(cells[3]),
        matchs: cellValue(cells[4]),
        victoires: cellValue(cells[5]),
        defaites: cellValue(cells[6]),
        winPct: cellValue(cells[7]),
        actif: cellValue(cells[8]),
      });

      const sideValue = cellValue(cells[11]);
      if (sideValue !== null && fighters.length <= 5) {
        const indicators = ['combattants', 'matchs', 'meilleurElo', 'eloMoyen', 'dernierMatch'];
        const key = indicators[fighters.length - 1];
        if (key) stats[key] = sideValue;
      }
      continue;
    }

    const indicator = cellValue(cells[10]);
    const value = cellValue(cells[11]);
    if (indicator !== null && value !== null) {
      const rank = parseInt(indicator, 10);
      if (!Number.isNaN(rank) && typeof value === 'string' && value !== 'Affichage') {
        gradeLegend.push({ rank, name: value });
      }
    }
  }

  gradeLegend.sort((a, b) => a.rank - b.rank);

  return { fighters, stats, gradeLegend };
}

export async function fetchFighterCards() {
  const response = await fetch(CONFIG.fightersDataPath);
  if (!response.ok) {
    return {};
  }
  const data = await response.json();
  return data.fighters || {};
}
