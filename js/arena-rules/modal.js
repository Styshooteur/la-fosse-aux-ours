import {
  isRulesHtmlEmpty,
  sanitizeRulesHtml,
  setLastSeenAnnouncementsAt,
  shouldAutoShowRules,
  RULE_SECTION_LABELS,
} from './utils.js';
let cachedRules = null;
let modalMode = 'summary';

const $ = (id) => document.getElementById(id);

function sectionBlock(title, html, { force = false, extraClass = '' } = {}) {
  if (!force && isRulesHtmlEmpty(html)) return '';
  const content = isRulesHtmlEmpty(html)
    ? '<p class="rules-rich-text rules-rich-text--empty">—</p>'
    : `<div class="rules-block-content rules-rich-text">${sanitizeRulesHtml(html)}</div>`;
  return `
    <section class="rules-block ${extraClass}">
      <h3 class="rules-block-title">${title}</h3>
      ${content}
    </section>`;
}

function buildSummaryBody(rules) {
  return `
    ${sectionBlock(RULE_SECTION_LABELS.announcements, rules.announcements)}
    ${sectionBlock(RULE_SECTION_LABELS.importantRules, rules.importantRules, { force: true, extraClass: 'rules-block--important' })}
  `;
}

function buildFullBody(rules) {
  return `
    ${sectionBlock(RULE_SECTION_LABELS.announcements, rules.announcements)}
    ${sectionBlock(RULE_SECTION_LABELS.importantRules, rules.importantRules, { force: true, extraClass: 'rules-block--important' })}
    ${sectionBlock(RULE_SECTION_LABELS.body, rules.body)}
  `;
}

function renderModalFooter(mode) {
  const footer = $('rules-modal-footer');
  if (!footer) return;

  if (mode === 'summary') {
    footer.innerHTML = `
      <button type="button" class="rules-btn rules-btn--primary" id="rules-expand-btn">
        Voir toutes les règles
      </button>`;
    $('rules-expand-btn')?.addEventListener('click', () => openRulesModal('full'));
    footer.classList.remove('hidden');
    footer.hidden = false;
  } else {
    footer.innerHTML = '';
    footer.classList.add('hidden');
    footer.hidden = true;
  }
}

function renderModalContent(mode) {
  if (!cachedRules) return;

  const title = $('rules-modal-title');
  const body = $('rules-modal-body');
  if (!title || !body) return;

  modalMode = mode;

  if (mode === 'summary') {
    title.textContent = 'Veuillez prendre connaissance des règles de l\'arène';
    body.innerHTML = buildSummaryBody(cachedRules);
  } else {
    title.textContent = 'Règles de l\'arène';
    body.innerHTML = buildFullBody(cachedRules);
  }

  renderModalFooter(mode);
}

export function openRulesModal(mode = 'full') {
  if (!cachedRules) return;

  renderModalContent(mode);

  const overlay = $('rules-modal');
  if (!overlay) return;

  overlay.classList.remove('hidden');
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  $('rules-modal-close')?.focus();
}

export function closeRulesModal({ persistSeen = true } = {}) {
  const overlay = $('rules-modal');
  if (!overlay) return;

  overlay.classList.add('hidden');
  overlay.hidden = true;
  document.body.style.overflow = '';

  if (persistSeen && cachedRules) {
    setLastSeenAnnouncementsAt(cachedRules.announcementsUpdatedAt || '__none__');
  }
}

export function renderRulesPage(container) {
  if (!container || !cachedRules) return;

  container.innerHTML = `
    <div class="rules-page-inner">
      <h2 class="rules-page-title">Règles de l'arène</h2>
      ${buildFullBody(cachedRules)}
    </div>`;
}

export async function fetchArenaRules({ force = false } = {}) {
  if (!force && cachedRules) return cachedRules;

  const res = await fetch('/api/arena-rules/public', { cache: 'no-store' });
  if (!res.ok) throw new Error('Impossible de charger les règles.');
  const data = await res.json();
  cachedRules = data;
  return data;
}

export function getCachedArenaRules() {
  return cachedRules;
}

function bindModalEvents() {
  $('rules-modal-close')?.addEventListener('click', () => closeRulesModal());
  $('rules-modal')?.addEventListener('click', (event) => {
    if (event.target === $('rules-modal')) closeRulesModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('rules-modal')?.classList.contains('hidden')) {
      closeRulesModal();
    }
  });
}

export async function initArenaRulesPublic() {
  bindModalEvents();

  try {
    const rules = await fetchArenaRules();

    const page = $('rules-page-content');
    if (page) renderRulesPage(page);

    if (shouldAutoShowRules(rules.announcementsUpdatedAt)) {
      openRulesModal('summary');
    }
  } catch (err) {
    console.error('Erreur chargement règles', err);
  }
}

export function refreshRulesPage({ force = false } = {}) {
  const page = $('rules-page-content');
  if (!page) return;

  if (cachedRules && !force) {
    renderRulesPage(page);
    return;
  }

  fetchArenaRules({ force })
    .then(() => renderRulesPage(page))
    .catch((err) => console.error('Erreur rechargement règles', err));
}
