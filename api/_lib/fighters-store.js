import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { head, put } from '@vercel/blob';
import { getBlobCallOptions, isBlobConfigured } from './blob.js';
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

  try {
    const meta = await head(FIGHTERS_REGISTRY_BLOB, getBlobCallOptions());
    if (!meta?.url) return {};

    const response = await fetch(meta.url, { cache: 'no-store' });
    if (!response.ok) return {};

    const data = await response.json();
    return data.fighters || {};
  } catch {
    return {};
  }
}

export async function getFightersMap() {
  const base = loadBaseFighters();
  const overlay = await loadRegistryOverlay();
  return { ...base, ...overlay };
}

export async function saveFighterPortrait(name, imageUrl) {
  const current = await loadRegistryOverlay();
  current[name] = { image: imageUrl };

  await put(FIGHTERS_REGISTRY_BLOB, JSON.stringify({ fighters: current }, null, 2), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    ...getBlobCallOptions(),
  });

  return imageUrl;
}
