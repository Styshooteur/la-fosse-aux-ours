export const PORTRAIT_WIDTH = 857;
export const PORTRAIT_HEIGHT = 1024;

/**
 * Ouvre l'éditeur de portrait (zoom + déplacement) et renvoie une image 857×1024.
 */
export function openPortraitEditor(file, fighterName) {
  return new Promise((resolve, reject) => {
    const overlay = document.getElementById('editor-overlay');
    const viewport = document.getElementById('editor-viewport');
    const img = document.getElementById('editor-image');
    const zoomInput = document.getElementById('editor-zoom');
    const title = document.getElementById('editor-title');
    const btnCancel = document.getElementById('editor-cancel');
    const btnSave = document.getElementById('editor-save');

    if (!overlay || !viewport || !img) {
      reject(new Error('Éditeur de portrait introuvable.'));
      return;
    }

    const state = {
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      dragging: false,
      startX: 0,
      startY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      naturalW: 0,
      naturalH: 0,
    };

    let objectUrl = null;
    let cleaned = false;

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      img.removeAttribute('src');
      btnCancel.removeEventListener('click', onCancel);
      btnSave.removeEventListener('click', onSave);
      zoomInput.removeEventListener('input', onZoom);
      viewport.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    }

    function onCancel() {
      cleanup();
      reject(new Error('Édition annulée.'));
    }

    function getViewportSize() {
      const rect = viewport.getBoundingClientRect();
      return { w: rect.width, h: rect.height };
    }

    function getBaseScale() {
      const { w, h } = getViewportSize();
      // Échelle « contenir » : toute l'image est visible à 100 %, zoom ensuite
      return Math.min(w / state.naturalW, h / state.naturalH);
    }

    function getDisplayScale() {
      return getBaseScale() * state.zoom;
    }

    function applyTransform() {
      const { w, h } = getViewportSize();
      const scale = getDisplayScale();
      const dw = state.naturalW * scale;
      const dh = state.naturalH * scale;
      const x = (w - dw) / 2 + state.offsetX;
      const y = (h - dh) / 2 + state.offsetY;

      img.style.width = `${dw}px`;
      img.style.height = `${dh}px`;
      img.style.transform = `translate(${x}px, ${y}px)`;
    }

    function clampOffsets() {
      const { w, h } = getViewportSize();
      const scale = getDisplayScale();
      const dw = state.naturalW * scale;
      const dh = state.naturalH * scale;

      const baseX = (w - dw) / 2;
      const baseY = (h - dh) / 2;

      let absX = baseX + state.offsetX;
      let absY = baseY + state.offsetY;

      if (dw > w) {
        absX = Math.min(0, Math.max(w - dw, absX));
      } else {
        absX = Math.min(w - dw, Math.max(0, absX));
      }

      if (dh > h) {
        absY = Math.min(0, Math.max(h - dh, absY));
      } else {
        absY = Math.min(h - dh, Math.max(0, absY));
      }

      state.offsetX = absX - baseX;
      state.offsetY = absY - baseY;
    }

    function onZoom() {
      state.zoom = Number(zoomInput.value) / 100;
      clampOffsets();
      applyTransform();
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      state.dragging = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.startOffsetX = state.offsetX;
      state.startOffsetY = state.offsetY;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add('is-dragging');
    }

    function onPointerMove(e) {
      if (!state.dragging) return;
      state.offsetX = state.startOffsetX + (e.clientX - state.startX);
      state.offsetY = state.startOffsetY + (e.clientY - state.startY);
      clampOffsets();
      applyTransform();
    }

    function onPointerUp(e) {
      if (!state.dragging) return;
      state.dragging = false;
      viewport.classList.remove('is-dragging');
      if (viewport.hasPointerCapture(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
      }
    }

    function exportPortrait() {
      const { w, h } = getViewportSize();
      const scale = getDisplayScale();
      const dw = state.naturalW * scale;
      const dh = state.naturalH * scale;
      const x = (w - dw) / 2 + state.offsetX;
      const y = (h - dh) / 2 + state.offsetY;

      const ratioX = PORTRAIT_WIDTH / w;
      const ratioY = PORTRAIT_HEIGHT / h;

      const canvas = document.createElement('canvas');
      canvas.width = PORTRAIT_WIDTH;
      canvas.height = PORTRAIT_HEIGHT;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#e8dcc4';
      ctx.fillRect(0, 0, PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
      ctx.drawImage(img, x * ratioX, y * ratioY, dw * ratioX, dh * ratioY);

      return canvas.toDataURL('image/jpeg', 0.92);
    }

    function onSave() {
      try {
        const dataUrl = exportPortrait();
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    }

    title.textContent = `Ajuster le portrait — ${fighterName}`;
    state.offsetX = 0;
    state.offsetY = 0;
    state.zoom = 1;
    zoomInput.value = '100';

    objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      state.naturalW = img.naturalWidth;
      state.naturalH = img.naturalHeight;
      applyTransform();
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('Impossible de charger l\'image.'));
    };
    img.src = objectUrl;

    btnCancel.addEventListener('click', onCancel);
    btnSave.addEventListener('click', onSave);
    zoomInput.addEventListener('input', onZoom);
    viewport.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(applyTransform);
  });
}
