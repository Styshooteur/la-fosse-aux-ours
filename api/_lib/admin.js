import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';

function pinsMatch(provided, expected) {
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyPin(pin) {
  if (!pin || typeof pin !== 'string') return false;

  if (process.env.ADMIN_PIN) {
    return pinsMatch(pin, process.env.ADMIN_PIN);
  }

  // En production Vercel, ADMIN_PIN est obligatoire (configuré dans le dashboard).
  if (process.env.VERCEL) {
    return false;
  }

  // Dev local uniquement : data/admin-config.json (non versionné).
  try {
    const configPath = join(process.cwd(), 'data', 'admin-config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const localPin = config.pin;
    if (!localPin) return false;
    return pinsMatch(pin, localPin);
  } catch {
    return false;
  }
}

export function getAdminPinFromRequest(req) {
  const header = req.headers['x-admin-pin'];
  if (typeof header === 'string' && header) return header;
  const queryPin = req.query?.pin;
  if (typeof queryPin === 'string' && queryPin) return queryPin;
  return req.body?.pin || '';
}
