import Quill from 'https://cdn.jsdelivr.net/npm/quill@2.0.3/+esm';

const SECTIONS = [
  { key: 'announcements', label: 'Annonces' },
  { key: 'importantRules', label: 'Règles importantes' },
  { key: 'body', label: 'Corps du texte' },
];

const TOOLBAR = [
  ['bold', 'italic', 'underline'],
  [{ size: ['small', false, 'large', 'huge'] }],
];

export function initArenaRulesAdmin({ root, getPin, showStatus }) {

  root.innerHTML = `
    <div class="arena-rules-admin" id="arena-rules-admin">
      <div class="arena-rules-admin-header">
        <h2>Règles de l'arène</h2>
        <p class="arena-rules-admin-note">Modifiez les trois sections ci-dessous. Les annonces mises à jour réaffichent le pop-up aux visiteurs.</p>
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

  $sections.innerHTML = SECTIONS.map(
    ({ key, label }) => `
    <section class="arena-rules-editor-card" data-section="${key}">
      <h3 class="arena-rules-editor-title">${label}</h3>
      <div class="arena-rules-editor-host" id="editor-${key}"></div>
    </section>`
  ).join('');

  for (const { key } of SECTIONS) {
    editors[key] = new Quill(`#editor-${key}`, {
      theme: 'snow',
      modules: { toolbar: TOOLBAR },
      placeholder: 'Saisissez le contenu…',
    });
  }

  async function load() {
    try {
      const res = await fetch('/api/arena-rules', {
        headers: { 'X-Admin-Pin': getPin() },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossible de charger les règles.');

      for (const { key } of SECTIONS) {
        editors[key].root.innerHTML = data[key] || '';
      }
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
      sections[key] = editors[key].root.innerHTML;
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
