/**
 * Normalise le HTML des règles (collage externe, chargement, sauvegarde).
 * Produit uniquement : p, br, strong, em, u, span.ql-* autorisés.
 */

const BLOCK_TAGS = new Set([
  'p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'section', 'article', 'td', 'th', 'tr',
]);

const SKIP_TAGS = new Set(['script', 'style', 'meta', 'link', 'head', 'o:p']);

const SIZE_STEPS = [
  { max: 11, value: 'xs' },
  { max: 13, value: 'sm' },
  { max: 15, value: '' },
  { max: 17, value: 'md' },
  { max: 19, value: 'lg' },
  { max: 21, value: 'xl' },
  { max: 24, value: 'xxl' },
  { max: Infinity, value: 'xxxl' },
];

const LEGACY_SIZE_MAP = {
  small: 'sm',
  large: 'lg',
  huge: 'xxxl',
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function defaultFmt() {
  return { bold: false, italic: false, underline: false, font: '', size: '' };
}

function cloneFmt(fmt) {
  return { ...fmt };
}

function parseFontSizePx(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  const pxMatch = v.match(/^([\d.]+)\s*px$/);
  if (pxMatch) return parseFloat(pxMatch[1]);
  const ptMatch = v.match(/^([\d.]+)\s*pt$/);
  if (ptMatch) return parseFloat(ptMatch[1]) * (96 / 72);
  const remMatch = v.match(/^([\d.]+)\s*rem$/);
  if (remMatch) return parseFloat(remMatch[1]) * 16;
  const emMatch = v.match(/^([\d.]+)\s*em$/);
  if (emMatch) return parseFloat(emMatch[1]) * 16;
  const named = {
    'xx-small': 10,
    'x-small': 11,
    small: 12,
    medium: 16,
    large: 18,
    'x-large': 20,
    'xx-large': 24,
    'xxx-large': 28,
  };
  if (named[v] != null) return named[v];
  const num = parseFloat(v);
  return Number.isFinite(num) ? num : null;
}

function mapSizeClass(px) {
  if (px == null) return '';
  for (const step of SIZE_STEPS) {
    if (px <= step.max) {
      return step.value ? `ql-size-${step.value}` : '';
    }
  }
  return 'ql-size-xxxl';
}

function normalizeQuillSizeClass(className) {
  if (!className?.startsWith('ql-size-')) return '';
  const raw = className.slice('ql-size-'.length);
  const mapped = LEGACY_SIZE_MAP[raw] || raw;
  if (!mapped) return '';
  const allowed = new Set(['xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'xxxl', 'small', 'large', 'huge']);
  return allowed.has(mapped) ? `ql-size-${mapped}` : '';
}

function mapFontClass(fontFamily) {
  if (!fontFamily) return '';
  const f = fontFamily.toLowerCase();
  if (f.includes('medieval')) return 'ql-font-medieval';
  if (f.includes('unifraktur') || f.includes('maguntia')) return 'ql-font-gothique';
  if (f.includes('garamond')) return 'ql-font-garamond';
  if (f.includes('georgia') || f.includes('times')) return 'ql-font-classique';
  if (f.includes('arial') || f.includes('helvetica') || f.includes('sans-serif')) return 'ql-font-sans';
  return '';
}

function readFmtFromElement(el, base) {
  const fmt = cloneFmt(base);
  const tag = el.tagName.toLowerCase();
  if (tag === 'strong' || tag === 'b') fmt.bold = true;
  if (tag === 'em' || tag === 'i') fmt.italic = true;
  if (tag === 'u') fmt.underline = true;

  for (const cls of el.classList || []) {
    if (cls.startsWith('ql-font-')) fmt.font = cls;
    if (cls.startsWith('ql-size-')) {
      fmt.size = normalizeQuillSizeClass(cls) || fmt.size;
    }
  }

  const style = el.getAttribute('style') || '';
  const fontSize = style.match(/font-size\s*:\s*([^;]+)/i)?.[1];
  const fontFamily = style.match(/font-family\s*:\s*([^;]+)/i)?.[1];
  const sizePx = parseFontSizePx(fontSize?.trim());
  const sizeClass = mapSizeClass(sizePx);
  if (sizeClass) fmt.size = sizeClass;
  const fontClass = mapFontClass(fontFamily);
  if (fontClass) fmt.font = fontClass;
  if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) fmt.bold = true;
  if (/font-style\s*:\s*italic/i.test(style)) fmt.italic = true;
  if (/text-decoration\s*:\s*[^;]*underline/i.test(style)) fmt.underline = true;

  return fmt;
}

function normalizeText(text) {
  return String(text)
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function pushText(runs, text, fmt) {
  const clean = normalizeText(text);
  if (!clean) return;
  const prev = runs[runs.length - 1];
  if (
    prev &&
    prev.type === 'text' &&
    prev.bold === fmt.bold &&
    prev.italic === fmt.italic &&
    prev.underline === fmt.underline &&
    prev.font === fmt.font &&
    prev.size === fmt.size
  ) {
    prev.text += clean;
    return;
  }
  runs.push({
    type: 'text',
    text: clean,
    bold: fmt.bold,
    italic: fmt.italic,
    underline: fmt.underline,
    font: fmt.font,
    size: fmt.size,
  });
}

function collectRuns(node, fmt, runs) {
  if (node.nodeType === Node.TEXT_NODE) {
    pushText(runs, node.textContent, fmt);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const tag = node.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return;

  if (tag === 'br') {
    runs.push({ type: 'break' });
    return;
  }

  const nextFmt = readFmtFromElement(node, fmt);
  for (const child of node.childNodes) {
    collectRuns(child, nextFmt, runs);
  }
}

function hasMeaningfulRuns(runs) {
  return runs.some((r) => r.type === 'text' && r.text.trim());
}

function trimRuns(runs) {
  while (runs.length && runs[0].type === 'break') runs.shift();
  while (runs.length && runs[runs.length - 1].type === 'break') runs.pop();
  const out = [];
  let prevBreak = false;
  for (const run of runs) {
    if (run.type === 'break') {
      if (!prevBreak && out.length) {
        out.push(run);
        prevBreak = true;
      }
      continue;
    }
    out.push(run);
    prevBreak = false;
  }
  return out;
}

function serializeRuns(runs) {
  const trimmed = trimRuns(runs);
  if (!hasMeaningfulRuns(trimmed)) return '';

  let inner = '';
  for (const run of trimmed) {
    if (run.type === 'break') {
      inner += '<br>';
      continue;
    }
    let chunk = escapeHtml(run.text);
    const classes = [run.font, run.size].filter(Boolean).join(' ');
    if (classes) chunk = `<span class="${classes}">${chunk}</span>`;
    if (run.underline) chunk = `<u>${chunk}</u>`;
    if (run.italic) chunk = `<em>${chunk}</em>`;
    if (run.bold) chunk = `<strong>${chunk}</strong>`;
    inner += chunk;
  }

  const plain = inner.replace(/<[^>]+>/g, '').trim();
  if (!plain) return '';
  return `<p>${inner}</p>`;
}

function extractBlocks(root) {
  const blocks = [];

  function addBlockFromNode(node) {
    const runs = [];
    collectRuns(node, defaultFmt(), runs);
    if (hasMeaningfulRuns(runs)) blocks.push(runs);
  }

  function walk(node, inlineBuffer) {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(inlineBuffer, node.textContent, defaultFmt());
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return;

    if (BLOCK_TAGS.has(tag)) {
      const hasNestedBlocks = [...node.childNodes].some(
        (child) =>
          child.nodeType === Node.ELEMENT_NODE &&
          BLOCK_TAGS.has(child.tagName.toLowerCase())
      );
      if (hasNestedBlocks) {
        for (const child of node.childNodes) {
          walk(child, inlineBuffer);
        }
        return;
      }
      addBlockFromNode(node);
      return;
    }

    if (tag === 'br') {
      inlineBuffer.push({ type: 'break' });
      return;
    }

    const nextFmt = readFmtFromElement(node, defaultFmt());
    for (const child of node.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(child.tagName.toLowerCase())) {
        if (hasMeaningfulRuns(inlineBuffer)) blocks.push(trimRuns([...inlineBuffer]));
        inlineBuffer.length = 0;
        walk(child, inlineBuffer);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'br') {
        inlineBuffer.push({ type: 'break' });
      } else if (child.nodeType === Node.TEXT_NODE) {
        pushText(inlineBuffer, child.textContent, nextFmt);
      } else {
        collectRuns(child, nextFmt, inlineBuffer);
      }
    }
  }

  const inlineBuffer = [];
  for (const child of root.childNodes) {
    walk(child, inlineBuffer);
  }
  if (hasMeaningfulRuns(inlineBuffer)) blocks.push(trimRuns(inlineBuffer));

  if (!blocks.length) {
    const runs = [];
    collectRuns(root, defaultFmt(), runs);
    if (hasMeaningfulRuns(runs)) blocks.push(trimRuns(runs));
  }

  return blocks;
}

export function plainTextToRulesHtml(text) {
  const normalized = normalizeText(text).trim();
  if (!normalized) return '';
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph.split('\n').map(escapeHtml);
      return `<p>${lines.join('<br>')}</p>`;
    })
    .join('');
}

export function normalizeRulesHtml(html) {
  const raw = String(html || '').trim();
  if (!raw) return '';

  if (typeof DOMParser === 'undefined') {
    return raw;
  }

  const doc = new DOMParser().parseFromString(`<body>${raw}</body>`, 'text/html');
  const blocks = extractBlocks(doc.body);
  return blocks.map(serializeRuns).filter(Boolean).join('');
}
