import { DateTime } from 'https://esm.sh/luxon@3.6.1';

export const WEEKDAYS = [
  { key: 'monday', label: 'Lundi' },
  { key: 'tuesday', label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday', label: 'Vendredi' },
  { key: 'saturday', label: 'Samedi' },
  { key: 'sunday', label: 'Dimanche' },
];

export const WEEKDAY_KEYS = WEEKDAYS.map((d) => d.key);

const PARIS = 'Europe/Paris';

export function getParisNow() {
  return DateTime.now().setZone(PARIS);
}

export function formatTimeFr(hhmm) {
  const [h, m] = String(hhmm || '').split(':');
  if (!h || m === undefined) return hhmm;
  return `${h}h${m.padStart(2, '0')}`;
}

export function formatDaySlots(day) {
  if (!day?.open || !day.slots?.length) return 'Fermé';
  return day.slots
    .map((slot) => `${formatTimeFr(slot.start)} - ${formatTimeFr(slot.end)}`)
    .join(', ');
}

export function isArenaOpenNow(schedule) {
  if (!schedule) return false;

  const now = getParisNow();
  const dayKey = WEEKDAY_KEYS[now.weekday - 1];
  const day = schedule[dayKey];

  if (!day?.open || !day.slots?.length) return false;

  const nowMinutes = now.hour * 60 + now.minute;

  return day.slots.some((slot) => {
    const [sh, sm] = String(slot.start).split(':').map(Number);
    const [eh, em] = String(slot.end).split(':').map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (endMin <= startMin) return false;
    return nowMinutes >= startMin && nowMinutes < endMin;
  });
}

export function defaultDay(closed = true) {
  return closed
    ? { open: false, slots: [] }
    : { open: true, slots: [{ start: '10:00', end: '18:00' }] };
}

export function defaultSchedule() {
  const schedule = {};
  for (const { key } of WEEKDAYS) {
    schedule[key] = defaultDay(true);
  }
  return schedule;
}

export function cloneSchedule(schedule) {
  return JSON.parse(JSON.stringify(schedule || defaultSchedule()));
}
