import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div'],
  allowedAttributes: {
    span: ['class'],
    p: ['class'],
    div: ['class'],
  },
  allowedClasses: {
    span: ['ql-size-small', 'ql-size-large', 'ql-size-huge'],
    p: ['ql-align-center', 'ql-align-right', 'ql-align-justify'],
    div: ['ql-align-center', 'ql-align-right', 'ql-align-justify'],
  },
  disallowedTagsMode: 'discard',
};

export function defaultArenaRules() {
  return {
    announcements: '',
    importantRules: '',
    body: '',
    updatedAt: null,
    announcementsUpdatedAt: null,
  };
}

function sanitizeSection(html) {
  if (html == null) return '';
  return sanitizeHtml(String(html), SANITIZE_OPTIONS).trim();
}

export function sanitizeArenaRules(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Contenu des règles invalide.');
  }

  return {
    announcements: sanitizeSection(input.announcements),
    importantRules: sanitizeSection(input.importantRules),
    body: sanitizeSection(input.body),
    updatedAt: new Date().toISOString(),
  };
}

export function buildArenaRulesPayload(sanitized, existing = null) {
  const announcementsChanged =
    !existing || sanitized.announcements !== (existing.announcements || '');

  return {
    announcements: sanitized.announcements,
    importantRules: sanitized.importantRules,
    body: sanitized.body,
    updatedAt: sanitized.updatedAt,
    announcementsUpdatedAt: announcementsChanged
      ? sanitized.updatedAt
      : existing?.announcementsUpdatedAt || sanitized.updatedAt,
  };
}
