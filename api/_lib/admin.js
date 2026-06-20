import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function verifyPin(pin) {
  if (process.env.ADMIN_PIN) {
    return pin === process.env.ADMIN_PIN;
  }

  try {
    const configPath = join(process.cwd(), 'data', 'admin-config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return pin === (config.pin || 'ours-vendeaume');
  } catch {
    return pin === 'ours-vendeaume';
  }
}
