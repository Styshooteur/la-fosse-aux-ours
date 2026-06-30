import {
  WEEKDAYS,
  cloneSchedule,
  defaultDay,
  defaultSchedule,
} from './schedule.js';

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function renderSlotRow(dayKey, slot, index, canRemove) {
  return `
    <div class="hours-slot" data-day="${dayKey}" data-slot-index="${index}">
      <label class="hours-time-label">
        <span class="sr-only">Début</span>
        <input type="time" class="hours-time-input" data-field="start" value="${escapeAttr(slot.start)}" required />
      </label>
      <span class="hours-time-sep" aria-hidden="true">à</span>
      <label class="hours-time-label">
        <span class="sr-only">Fin</span>
        <input type="time" class="hours-time-input" data-field="end" value="${escapeAttr(slot.end)}" required />
      </label>
      ${
        canRemove
          ? `<button type="button" class="hours-slot-remove" data-action="remove-slot" data-day="${dayKey}" data-slot-index="${index}" title="Supprimer cette tranche" aria-label="Supprimer cette tranche">×</button>`
          : ''
      }
    </div>`;
}

function renderDayRow(dayKey, label, day) {
  const open = Boolean(day.open);
  const slots = open && day.slots?.length ? day.slots : [{ start: '10:00', end: '18:00' }];

  return `
    <article class="hours-day" data-day="${dayKey}">
      <header class="hours-day-header">
        <h3 class="hours-day-title">${label}</h3>
        <label class="hours-open-toggle">
          <input type="checkbox" class="hours-open-checkbox" data-day="${dayKey}" ${open ? 'checked' : ''} />
          <span class="hours-open-slider" aria-hidden="true"></span>
          <span class="hours-open-label" data-open-label="${dayKey}">${open ? 'Ouvert' : 'Fermé'}</span>
        </label>
      </header>
      <div class="hours-day-body ${open ? '' : 'hidden'}" data-day-body="${dayKey}">
        <div class="hours-slots" data-slots="${dayKey}">
          ${slots.map((slot, i) => renderSlotRow(dayKey, slot, i, slots.length > 1)).join('')}
        </div>
        <button type="button" class="hours-add-slot" data-action="add-slot" data-day="${dayKey}">
          + Ajouter une tranche horaire
        </button>
      </div>
    </article>`;
}

function readDayFromDom(dayKey, root) {
  const article = root.querySelector(`.hours-day[data-day="${dayKey}"]`);
  const open = article.querySelector('.hours-open-checkbox')?.checked ?? false;

  if (!open) {
    return { open: false, slots: [] };
  }

  const slots = [...article.querySelectorAll(`.hours-slot[data-day="${dayKey}"]`)].map((row) => ({
    start: row.querySelector('[data-field="start"]')?.value || '10:00',
    end: row.querySelector('[data-field="end"]')?.value || '18:00',
  }));

  return { open: true, slots: slots.length ? slots : [{ start: '10:00', end: '18:00' }] };
}

function readScheduleFromDom(root) {
  const schedule = {};
  for (const { key } of WEEKDAYS) {
    schedule[key] = readDayFromDom(key, root);
  }
  return schedule;
}

function rerenderDay(dayKey, schedule, root) {
  const { label } = WEEKDAYS.find((d) => d.key === dayKey);
  const article = root.querySelector(`.hours-day[data-day="${dayKey}"]`);
  if (!article) return;
  const replacement = document.createElement('div');
  replacement.innerHTML = renderDayRow(dayKey, label, schedule[dayKey]);
  article.replaceWith(replacement.firstElementChild);
}

export function initOpeningHoursAdmin({ root, getPin, showStatus }) {
  let schedule = defaultSchedule();
  let dirty = false;

  root.innerHTML = `
    <div class="hours-admin" id="hours-admin">
      <div class="hours-admin-header">
        <h2>Horaires d'ouverture</h2>
        <p class="hours-admin-note">Configurez les créneaux pour chaque jour. Les horaires sont affichés sur la page d'accueil du site public.</p>
      </div>
      <div class="hours-days" id="hours-days"></div>
      <div class="hours-admin-actions">
        <button type="button" class="hours-save-btn" id="hours-save-btn">Enregistrer</button>
        <span class="hours-dirty hidden" id="hours-dirty" aria-live="polite">Modifications non enregistrées</span>
      </div>
    </div>`;

  const $days = root.querySelector('#hours-days');
  const $save = root.querySelector('#hours-save-btn');
  const $dirty = root.querySelector('#hours-dirty');

  function setDirty(value) {
    dirty = value;
    $dirty.classList.toggle('hidden', !dirty);
    $save.classList.toggle('hours-save-btn--pending', dirty);
  }

  function renderAll() {
    $days.innerHTML = WEEKDAYS.map(({ key, label }) => renderDayRow(key, label, schedule[key])).join('');
    setDirty(false);
  }

  function bindDayEvents() {
    if ($days.dataset.bound === 'true') return;
    $days.dataset.bound = 'true';

    $days.addEventListener('change', (event) => {
      const input = event.target;
      if (!input.classList.contains('hours-open-checkbox') && !input.classList.contains('hours-time-input')) {
        return;
      }

      if (input.classList.contains('hours-open-checkbox')) {
        const dayKey = input.dataset.day;
        const open = input.checked;
        const label = $days.querySelector(`[data-open-label="${dayKey}"]`);
        if (label) label.textContent = open ? 'Ouvert' : 'Fermé';

        const body = $days.querySelector(`[data-day-body="${dayKey}"]`);
        body?.classList.toggle('hidden', !open);

        if (open) {
          const slots = $days.querySelector(`[data-slots="${dayKey}"]`);
          if (slots && !slots.children.length) {
            schedule[dayKey] = defaultDay(false);
            rerenderDay(dayKey, schedule, $days);
          }
        }
      }

      setDirty(true);
    });

    $days.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const dayKey = btn.dataset.day;

      if (action === 'add-slot') {
        schedule[dayKey] = readDayFromDom(dayKey, $days);
        schedule[dayKey].slots.push({ start: '14:00', end: '22:00' });
        rerenderDay(dayKey, schedule, $days);
        setDirty(true);
        return;
      }

      if (action === 'remove-slot') {
        const index = Number(btn.dataset.slotIndex);
        schedule[dayKey] = readDayFromDom(dayKey, $days);
        schedule[dayKey].slots.splice(index, 1);
        if (!schedule[dayKey].slots.length) {
          schedule[dayKey].slots.push({ start: '10:00', end: '18:00' });
        }
        rerenderDay(dayKey, schedule, $days);
        setDirty(true);
      }
    });
  }

  async function load() {
    try {
      const res = await fetch('/api/opening-hours', {
        headers: { 'X-Admin-Pin': getPin() },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossible de charger les horaires.');
      schedule = cloneSchedule(data.schedule || defaultSchedule());
      renderAll();
    } catch (err) {
      showStatus(err.message, true);
      schedule = defaultSchedule();
      renderAll();
    }
  }

  async function save() {
    schedule = readScheduleFromDom($days);
    $save.disabled = true;
    showStatus('Enregistrement des horaires…');

    try {
      const res = await fetch('/api/opening-hours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': getPin(),
        },
        body: JSON.stringify({ schedule }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de l\'enregistrement.');
      schedule = cloneSchedule(data.schedule);
      renderAll();
      showStatus('Horaires enregistrés.');
    } catch (err) {
      showStatus(err.message, true);
    } finally {
      $save.disabled = false;
    }
  }

  $save.addEventListener('click', save);
  bindDayEvents();

  return {
    async open() {
      await load();
    },
  };
}
