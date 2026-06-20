import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isBlobConfigured, putBlob, readBlobJson } from './blob.js';
import { FIGHTERS_REGISTRY_BLOB } from './config.js';

function loadBaseFighters() {
  try {
    const path = join(process.cwd(), 'data', 'fighters.json');
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return data.fighters || {};
  } catch {
    return {};
  }
}

async function loadRegistryOverlay() {
  if (!isBlobConfigured()) {
    return {};
  }

  const data = await readBlobJson(FIGHTERS_REGISTRY_BLOB);
  return data?.fighters || {};
}

export async function getFightersMap() {
  const base = loadBaseFighters();
  const overlay = await loadRegistryOverlay();
  return { ...base, ...overlay };
}

export async function saveFighterPortrait(name, imageUrl) {
  const current = await loadRegistryOverlay();
  current[name] = { image: imageUrl };

  await putBlob(
    FIGHTERS_REGISTRY_BLOB,
    JSON.stringify({ fighters: current }, null, 2),
    'application/json'
  );

  return imageUrl;
}
