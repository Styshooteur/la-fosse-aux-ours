/** Formats Quill partagés — garder les classes alignées avec api/_lib/arena-rules-validate.js */

export const QUILL_FONTS = [
  { value: 'garamond', label: 'Parchemin', family: "'EB Garamond', Georgia, serif" },
  { value: 'medieval', label: 'Médiéval', family: "'MedievalSharp', serif" },
  { value: 'gothique', label: 'Gothique', family: "'UnifrakturMaguntia', serif" },
  { value: 'classique', label: 'Classique', family: "Georgia, 'Times New Roman', serif" },
  { value: 'sans', label: 'Sobre', family: "Arial, Helvetica, sans-serif" },
];

export const QUILL_SIZE_OPTIONS = [
  { value: 'small', label: 'Petit' },
  { value: false, label: 'Normal' },
  { value: 'large', label: 'Grand' },
  { value: 'huge', label: 'Très grand' },
];

export const QUILL_FONT_CLASSES = QUILL_FONTS.map((f) => `ql-font-${f.value}`);

export const QUILL_SIZE_CLASSES = ['ql-size-small', 'ql-size-large', 'ql-size-huge'];

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
  Size.whitelist = ['small', 'large', 'huge'];
  Quill.register(Size, true);
}

export function buildQuillToolbar() {
  return [
    ['bold', 'italic', 'underline'],
    [{ font: QUILL_FONTS.map((f) => f.value) }],
    [{ size: QUILL_SIZE_OPTIONS.map((s) => s.value) }],
  ];
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
