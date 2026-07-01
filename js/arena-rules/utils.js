import DOMPurify from 'https://esm.sh/dompurify@3.2.4';

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div'],
  ALLOWED_ATTR: ['class'],
  ALLOWED_CLASSES: {
    span: ['ql-size-small', 'ql-size-large', 'ql-size-huge'],
    p: ['ql-align-center', 'ql-align-right', 'ql-align-justify'],
    div: ['ql-align-center', 'ql-align-right', 'ql-align-justify'],
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
