/** Formats Quill partagés — garder les classes alignées avec api/_lib/arena-rules-validate.js */

export const QUILL_FONTS = [
  { value: 'garamond', label: 'EB Garamond', family: "'EB Garamond', Georgia, serif" },
  { value: 'medieval', label: 'MedievalSharp', family: "'MedievalSharp', serif" },
  { value: 'gothique', label: 'Unifraktur Maguntia', family: "'UnifrakturMaguntia', serif" },
  { value: 'classique', label: 'Georgia', family: "Georgia, 'Times New Roman', serif" },
  { value: 'sans', label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
];

export const QUILL_SIZE_OPTIONS = [
  { value: 'xs', label: 'Très petit' },
  { value: 'sm', label: 'Petit' },
  { value: false, label: 'Normal' },
  { value: 'md', label: 'Moyen' },
  { value: 'lg', label: 'Grand' },
  { value: 'xl', label: 'Très grand' },
  { value: 'xxl', label: 'Énorme' },
  { value: 'xxxl', label: 'Gigantesque' },
];

export const QUILL_SIZE_WHITELIST = QUILL_SIZE_OPTIONS
  .map((s) => s.value)
  .filter(Boolean);

export const QUILL_FONT_CLASSES = QUILL_FONTS.map((f) => `ql-font-${f.value}`);

export const QUILL_SIZE_CLASSES = [
  ...QUILL_SIZE_WHITELIST.map((v) => `ql-size-${v}`),
  'ql-size-small',
  'ql-size-large',
  'ql-size-huge',
];

export const QUILL_ALIGN_CLASSES = [
  'ql-align-center',
  'ql-align-right',
  'ql-align-justify',
];

export function registerQuillFormats(Quill) {
  const Font = Quill.import('formats/font');
  Font.whitelist = QUILL_FONTS.map((f) => f.value);
  Quill.register(Font, true);

  const Size = Quill.import('attributors/class/size');
  Size.whitelist = QUILL_SIZE_WHITELIST;
  Quill.register(Size, true);
}

export function buildToolbarHtml(toolbarId) {
  const fontOptions = QUILL_FONTS.map(
    (f) => `<option value="${f.value}">${f.label}</option>`
  ).join('');

  const sizeOptions = QUILL_SIZE_OPTIONS.map((s) => {
    if (s.value === false) {
      return `<option selected>${s.label}</option>`;
    }
    return `<option value="${s.value}">${s.label}</option>`;
  }).join('');

  return `
    <div id="${toolbarId}" class="arena-rules-toolbar ql-toolbar ql-snow">
      <span class="ql-formats">
        <button type="button" class="ql-bold" aria-label="Gras"></button>
        <button type="button" class="ql-italic" aria-label="Italique"></button>
        <button type="button" class="ql-underline" aria-label="Souligné"></button>
      </span>
      <span class="ql-formats">
        <select class="ql-font" aria-label="Police">${fontOptions}</select>
      </span>
      <span class="ql-formats">
        <select class="ql-size" aria-label="Taille">${sizeOptions}</select>
      </span>
    </div>`;
}

export function buildToolbarHandlers() {
  return {
    font(value) {
      const range = this.quill.getSelection(true);
      if (!range) return;
      this.quill.formatText(range.index, range.length, 'font', value || false, 'user');
    },
    size(value) {
      const range = this.quill.getSelection(true);
      if (!range) return;
      this.quill.formatText(range.index, range.length, 'size', value || false, 'user');
    },
  };
}

export function preserveToolbarSelection(editor) {
  const toolbar = editor.getModule('toolbar');
  if (!toolbar?.container) return;
  for (const btn of toolbar.container.querySelectorAll('button')) {
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
  }
}

export function setQuillHtml(editor, html) {
  const clean = String(html || '').trim();
  if (!clean) {
    editor.setText('', 'silent');
    return;
  }
  const delta = editor.clipboard.convert({ html: clean });
  editor.setContents(delta, 'silent');
}

export function getQuillHtml(editor) {
  return editor.getSemanticHTML().trim();
}
