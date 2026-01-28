import { getFileKind } from '../lib/files.js';

function createAttachmentUI({ rootEl, onClear } = {}) {
  if (!rootEl) throw new Error("createAttachmentUI: rootEl requerido");

  if (window.pdfjsLib?.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/assets/shared/vendor/pdfjs/pdf.worker.js";
  }

  // Expected HTML:
  // <div id="attachRow" class="attachRow"><div class="attachPreview"></div></div>
  const row = rootEl;
  const preview = row.querySelector(".attachPreview") || row;

  // Build stable DOM once (avoid innerHTML churn)
  preview.innerHTML = `
    <div class="attachChip fileCard" role="status" aria-live="polite">
      <div class="attachIcon fileCardIcon" aria-hidden="true"></div>
      <div class="attachMeta fileCardMeta">
        <div class="fileName fileCardName" title=""></div>
        <div class="attachStatus fileCardLabel"></div>
      </div>
      <button type="button" class="attachClear" aria-label="Quitar adjunto">×</button>
    </div>
  `;

  const chipEl = preview.querySelector(".attachChip");
  const iconEl = preview.querySelector(".attachIcon");
  const pillEl = null;
  const statusEl = preview.querySelector(".attachStatus");
  const nameEl = preview.querySelector(".fileName");
  const clearBtn = preview.querySelector(".attachClear");

  let lastMeta = null;
  let isSending = false;

  clearBtn.addEventListener("click", () => {
    hide();
    onClear?.();
  });

  function clampName(name, max = 42) {
    if (!name) return "";
    if (name.length <= max) return name;
    const head = Math.max(10, Math.floor(max * 0.6));
    const tail = Math.max(8, max - head - 1);
    return `${name.slice(0, head)}…${name.slice(-tail)}`;
  }

  function guessKind(file) {
    const name = (file?.name || "").toLowerCase();
    const mime = (file?.type || "").toLowerCase();

    const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
    const isDocx =
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx") ||
      name.endsWith(".doc");

    const isImage =
      mime.startsWith("image/") ||
      /\.(png|jpg|jpeg|gif|webp|bmp|heic|heif)$/i.test(name);

    if (isPdf) return { key: "pdf", label: "PDF" };
    if (isDocx) return { key: "docx", label: "DOC" };
    if (isImage) return { key: "image", label: "IMG" };
    return { key: "file", label: "FILE" };
  }

  function normalize(fileOrMeta, opts = {}) {
    // Support:
    // 1) show(file, { state, fileDataUrl })
    // 2) show({ file, state, fileDataUrl, fileName, fileMime })
    const meta =
      fileOrMeta &&
      typeof fileOrMeta === "object" &&
      ("file" in fileOrMeta || "fileDataUrl" in fileOrMeta)
        ? { ...fileOrMeta }
        : { file: fileOrMeta };

    const out = {
      file: meta.file,
      state: meta.state || opts.state || "ready",
      fileDataUrl: meta.fileDataUrl || opts.fileDataUrl || null,
      fileName: meta.fileName || opts.fileName || meta.file?.name || "",
      fileMime: meta.fileMime || opts.fileMime || meta.file?.type || "",
    };

    out.kind = guessKind(out.file || { name: out.fileName, type: out.fileMime });
    return out;
  }

  function setMode({ kindKey, state }) {
    chipEl.classList.remove(
      "is-loading",
      "is-ready",
      "is-pdf",
      "is-docx",
      "is-image",
      "is-file",
    );
    chipEl.classList.add(kindKey ? `is-${kindKey}` : "is-file");
    chipEl.classList.add(state === "loading" ? "is-loading" : "is-ready");
  }

  function renderIcon(meta) {
    // If we have a dataUrl (image or PDF thumb), show thumbnail
    if (meta.fileDataUrl && (meta.kind.key === "image" || meta.kind.key === "pdf")) {
      iconEl.innerHTML = `<img class="attachThumb" alt="" />`;
      const img = iconEl.querySelector("img");
      img.src = meta.fileDataUrl;
      return;
    }

    // Otherwise show a simple glyph (no external deps)
    const glyph =
      meta.kind.key === "pdf"
        ? "PDF"
        : meta.kind.key === "docx"
          ? "DOC"
          : meta.kind.key === "image"
            ? "IMG"
            : "FILE";

    iconEl.innerHTML = `<div class="attachGlyph" aria-hidden="true">${glyph}</div>`;
  }

  function show(fileOrMeta, opts = {}) {
    const meta = normalize(fileOrMeta, opts);
    lastMeta = meta;

    // During loading, we might not have dataUrl yet (that's fine)
    row.style.display = "flex";
    row.classList.add("show");
    row.classList.toggle("is-sending", isSending);

    setMode({ kindKey: meta.kind.key, state: meta.state });

    // Nombre siempre visible (cortado si es largo)
    nameEl.textContent = clampName(meta.fileName);
    nameEl.title = meta.fileName || "";

    // Etiqueta abajo (PDF/DOCX/IMG). Mantenemos igual que en chat.
    statusEl.textContent = meta.kind.label;

    renderIcon(meta);
  }

  function hide() {
    row.style.display = "none";
    row.classList.remove("show");
    row.classList.remove("is-sending");
    iconEl.innerHTML = "";
    statusEl.textContent = "";
    nameEl.textContent = "";
    nameEl.title = "";
    lastMeta = null;
  }

  function setSending(next) {
    isSending = !!next;
    row.classList.toggle("is-sending", isSending);
  }

  // Start hidden
  hide();

  return {
    show,
    hide,
    showAttachPreview: show,
    hideAttachPreview: hide,
    reflowPreview: () => {},
    setSending,
    getMeta: () => lastMeta,
    clear: hide,
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
