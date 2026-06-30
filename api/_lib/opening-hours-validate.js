export const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseMinutes(value) {
  const match = TIME_RE.exec(String(value || '').trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeSlot(slot) {
  if (!slot || typeof slot !== 'object') return null;
  const start = String(slot.start || '').trim();
  const end = String(slot.end || '').trim();
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return null;
  const startMin = parseMinutes(start);
  const endMin = parseMinutes(end);
  if (startMin === null || endMin === null || endMin <= startMin) return null;
  return { start, end };
}

export function defaultDay(closed = true) {
  return closed
    ? { open: false, slots: [] }
    : { open: true, slots: [{ start: '10:00', end: '18:00' }] };
}

export function defaultSchedule() {
  const schedule = {};
  for (const key of WEEKDAY_KEYS) {
    schedule[key] = defaultDay(true);
  }
  return schedule;
}

export function sanitizeSchedule(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Horaires invalides.');
  }

  const schedule = {};

  for (const key of WEEKDAY_KEYS) {
    const day = input[key];
    if (!day || typeof day !== 'object') {
      schedule[key] = defaultDay(true);
      continue;
    }

    const open = Boolean(day.open);
    if (!open) {
      schedule[key] = { open: false, slots: [] };
      continue;
    }

    const rawSlots = Array.isArray(day.slots) ? day.slots : [];
    const slots = rawSlots.map(normalizeSlot).filter(Boolean);
    if (!slots.length) {
      throw new Error(`Au moins une tranche horaire est requise pour ${key}.`);
    }

    schedule[key] = { open: true, slots };
  }

  return schedule;
}

export { parseMinutes, TIME_RE };
