import { getFileKind } from '../lib/files.js';

function createAttachmentUI({ rootEl, inp, update, onClear } = {}) {
  // rootEl puede no venir (o venir mal). No rompemos: usamos fallback.
  const mountEl = rootEl || getMount();

  if (!mountEl || !inp) {
    // Si falta algo crítico, no petamos la app entera: simplemente no montamos UI.
    return {
      clear() {},
      setPreview() {},
      destroy() {},
    };
  }

  const { row, iconEl, nameEl, clearBtn } = ensureAttachPreviewUI(mountEl);

  clearBtn.addEventListener('click', () => {
    try {
      inp.value = '';
    } catch {}
    try {
      update?.({ fileDataUrl: null, fileName: null, fileMime: null });
    } catch {}
    try {
      onClear?.();
    } catch {}
    hide();
  });

  function show({ file, fileDataUrl, fileName, fileMime } = {}) {
    const hasFile = !!fileDataUrl;
    if (!hasFile) return hide();

    const kind = getPreviewKind(file) || getPreviewKindFromMeta(fileMime, fileName);

    // Icono:
    // - imagen: miniatura real (dataUrl)
    // - pdf/doc: SVG “tile” con color
    if (kind.kind === 'image') {
      iconEl.src = fileDataUrl;
    } else {
      const icon = iconRenderer(kind);
      iconEl.src = icon?.dataUrl || defaultIconDataUrl(kind);
    }

    // Nombre: corto, sin salvajadas
    nameEl.className = 'attachName';
    if (kind?.cls) nameEl.classList.add(kind.cls);
    row.classList.remove('is-pdf', 'is-docx', 'is-img', 'is-file');
    if (kind?.cls) row.classList.add(`is-${kind.cls}`);
    nameEl.textContent = shortenMiddle(fileName || kind.label, 36);

    row.style.display = 'flex';
  }

  function hide() {
    row.style.display = 'none';
    // Limpieza visual
    iconEl.removeAttribute('src');
    nameEl.textContent = '';
  }

  // API mínima (por si ya la usáis en otros lados)
  return {
    clear: () => clearBtn.click(),
    setPreview: (data) => show(data),
    destroy: () => row.remove(),
  };
}

function getMount() {
  // Preferimos la fila de adjuntos; si no existe, usamos el footerRow.
  return (
    document.getElementById('attachRow') ||
    document.getElementById('footerRow') ||
    document.body
  );
}

function ensureAttachPreviewUI(root) {
  // Si ya existe, lo reutilizamos
  let row = root.querySelector?.('.attachPreview');
  if (row) {
    const iconEl = row.querySelector('img');
    const nameEl = row.querySelector('.attachName');
    const clearBtn = row.querySelector('button');
    return { row, iconEl, nameEl, clearBtn };
  }

  row = document.createElement('div');
  row.className = 'attachPreview';
  row.style.display = 'none';

  const iconEl = document.createElement('img');
  iconEl.alt = 'Adjunto';
  iconEl.loading = 'lazy';
  iconEl.decoding = 'async';

  const nameEl = document.createElement('span');
  nameEl.className = 'attachName';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.title = 'Quitar adjunto';
  clearBtn.textContent = '×';

  row.appendChild(iconEl);
  row.appendChild(nameEl);
  row.appendChild(clearBtn);

  // Lo metemos al principio del root (encima del composer)
  root.prepend(row);

  return { row, iconEl, nameEl, clearBtn };
}

export function getPreviewKind(file) {
  const info = getFileKind(file);
  if (info.isPDF)
    return { label: "PDF", cls: "pdf", color: "#d84a3d", isImage: false, kind: "pdf" };
  if (info.isDocx)
    return { label: "DOCX", cls: "docx", color: "#2b6de0", isImage: false, kind: "doc" };
  if (info.isImage) return { label: "IMG", cls: "img", isImage: true, kind: "image" };
  return { label: "FILE", cls: "file", isImage: false, kind: "file" };
}

function iconRenderer(kind) {
  // SVG “tile” (sin PDF.js, sin CDN, sin errores)
  const bg =
    kind.color ||
    (kind.kind === 'pdf'
      ? '#d64545'
      : kind.kind === 'doc'
      ? '#2b6cb0'
      : kind.kind === 'image'
      ? '#2f855a'
      : '#444');

  const label = kind.label || 'FILE';

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
    <rect x="0" y="0" width="72" height="72" rx="12" fill="${bg}"/>
    <rect x="10" y="10" width="52" height="52" rx="10" fill="rgba(255,255,255,0.10)"/>
    <text x="36" y="42" font-size="18" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial" font-weight="800"
      text-anchor="middle" fill="#fff">${escapeSvgText(label)}</text>
  </svg>`;

  return { dataUrl: svgToDataUrl(svg) };
}

function defaultIconDataUrl(kind) {
  return iconRenderer(kind)?.dataUrl;
}

function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shortenMiddle(str, max = 36) {
  const s = String(str || '');
  if (s.length <= max) return s;
  const keep = Math.max(6, Math.floor((max - 3) / 2));
  return `${s.slice(0, keep)}...${s.slice(-keep)}`;
}

function getPreviewKindFromMeta(fileMime, fileName) {
  const fake = { type: fileMime || "", name: fileName || "" };
  return getPreviewKind(fake);
}

export { createAttachmentUI };
export default createAttachmentUI;
