/** Échappe le texte avant insertion dans du HTML. */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/** N'accepte qu'une couleur hex (#RRGGBB) pour éviter les injections CSS. */
export function sanitizeHexColor(color, fallback = '#8f6118') {
  if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return fallback;
}
