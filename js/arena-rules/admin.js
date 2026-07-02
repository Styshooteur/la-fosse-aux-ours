import Quill from 'https://cdn.jsdelivr.net/npm/quill@2.0.3/+esm';
import { RULE_SECTIONS } from './utils.js';
import {
  registerQuillFormats,
  buildToolbarHtml,
  buildToolbarHandlers,
  preserveToolbarSelection,
  syncToolbarWithSelection,
  attachPasteNormalizer,
  setQuillHtml,
  getQuillHtml,
} from './formats.js';

const SECTIONS = RULE_SECTIONS;

registerQuillFormats(Quill);

export function initArenaRulesAdmin({ root, getPin, showStatus }) {
  root.innerHTML = `
    <div class="arena-rules-admin" id="arena-rules-admin">
      <div class="arena-rules-admin-header">
        <h2>Règles de l'arène</h2>
        <p class="arena-rules-admin-note">Modifiez les trois sections ci-dessous. Le bulletin des modifications mis à jour réaffiche le pop-up aux visiteurs.</p>
      </div>
      <div class="arena-rules-sections" id="arena-rules-sections"></div>
      <div class="arena-rules-admin-actions">
        <button type="button" class="arena-rules-save-btn" id="arena-rules-save-btn">
          Enregistrer toutes les sections
        </button>
      </div>
    </div>`;

  const $sections = root.querySelector('#arena-rules-sections');
  const editors = {};
  let hasLoaded = false;

  $sections.innerHTML = SECTIONS.map(
    ({ key, label }) => `
    <section class="arena-rules-editor-card" data-section="${key}">
      <h3 class="arena-rules-editor-title">${label}</h3>
      <div class="arena-rules-editor-host">
        ${buildToolbarHtml(`toolbar-${key}`)}
        <div class="arena-rules-editor-surface" id="editor-${key}"></div>
      </div>
    </section>`
  ).join('');

  for (const { key } of SECTIONS) {
    editors[key] = new Quill(`#editor-${key}`, {
      theme: 'snow',
      modules: {
        toolbar: {
          container: `#toolbar-${key}`,
          handlers: buildToolbarHandlers(),
        },
      },
      placeholder: 'Saisissez le contenu…',
    });
    preserveToolbarSelection(editors[key]);
    syncToolbarWithSelection(editors[key]);
    attachPasteNormalizer(editors[key], Quill);
  }

  function syncEditorsFromData(data) {
    for (const { key } of SECTIONS) {
      setQuillHtml(editors[key], data[key] || '');
    }
  }

  async function load({ force = false } = {}) {
    if (hasLoaded && !force) return;

    try {
      const res = await fetch('/api/arena-rules', {
        headers: { 'X-Admin-Pin': getPin() },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossible de charger les règles.');

      syncEditorsFromData(data);
      hasLoaded = true;
    } catch (err) {
      showStatus(err.message, true);
    }
  }

  async function save() {
    const btn = root.querySelector('#arena-rules-save-btn');
    if (btn) btn.disabled = true;
    showStatus('Enregistrement des règles…');

    const sections = {};
    for (const { key } of SECTIONS) {
      sections[key] = getQuillHtml(editors[key]);
    }

    try {
      const res = await fetch('/api/arena-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': getPin(),
        },
        body: JSON.stringify({ sections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de l\'enregistrement.');

      syncEditorsFromData(data);
      hasLoaded = true;
      showStatus('Règles enregistrées.');
    } catch (err) {
      showStatus(err.message, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  root.querySelector('#arena-rules-save-btn')?.addEventListener('click', save);

  return {
    async open() {
      await load();
    },
  };
}
