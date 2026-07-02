import DOMPurify from 'https://esm.sh/dompurify@3.2.4';
import {
  QUILL_FONT_CLASSES,
  QUILL_SIZE_CLASSES,
  QUILL_ALIGN_CLASSES,
} from './formats.js';

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div'],
  ALLOWED_ATTR: ['class'],
  ALLOWED_CLASSES: {
    span: [...QUILL_FONT_CLASSES, ...QUILL_SIZE_CLASSES, ...QUILL_ALIGN_CLASSES],
    p: [...QUILL_ALIGN_CLASSES],
    div: [...QUILL_ALIGN_CLASSES],
  },
};

export function sanitizeRulesHtml(html) {
  return DOMPurify.sanitize(String(html || ''), PURIFY_CONFIG);
}

export function isRulesHtmlEmpty(html) {
  const clean = sanitizeRulesHtml(html);
  const div = document.createElement('div');
  div.innerHTML = clean;
  return !div.textContent.trim();
}

export const RULES_STORAGE_KEY = 'fosse-rules-last-seen-announcements';

export const RULE_SECTIONS = [
  { key: 'announcements', label: 'Bulletin des modifications' },
  { key: 'importantRules', label: "Code essentiel de l'arène" },
  { key: 'body', label: 'Registre des règles' },
];

export const RULE_SECTION_LABELS = Object.fromEntries(
  RULE_SECTIONS.map(({ key, label }) => [key, label])
);

export function getLastSeenAnnouncementsAt() {
  try {
    return localStorage.getItem(RULES_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setLastSeenAnnouncementsAt(value) {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, value || '');
  } catch {
    /* ignore */
  }
}

export function shouldAutoShowRules(announcementsUpdatedAt) {
  const seen = getLastSeenAnnouncementsAt();
  if (!seen) return true;
  const current = announcementsUpdatedAt || '__none__';
  return seen !== current;
}
