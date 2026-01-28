// assets/student/attachments/attachmentsui.js
// Preview de adjuntos en el composer (antes de enviar): card tipo ChatGPT

function clampName(name, max = 46) {
  name = String(name || "");
  if (name.length <= max) return name;
  const head = Math.max(10, Math.floor(max * 0.62));
  const tail = Math.max(8, max - head - 1);
  return `${name.slice(0, head)}…${name.slice(-tail)}`;
}

function guessKind({ name = "", type = "" } = {}) {
  const n = String(name).toLowerCase();
  const m = String(type).toLowerCase();

  const isPdf = m === "application/pdf" || n.endsWith(".pdf");
  const isDocx =
    m ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    n.endsWith(".docx") || n.endsWith(".doc");
  const isImage = m.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|bmp|heic|heif)$/i.test(n);

  if (isPdf) return { key: "pdf", label: "PDF" };
  if (isDocx) return { key: "docx", label: "DOC" };
  if (isImage) return { key: "image", label: "IMG" };
  return { key: "file", label: "FILE" };
}

function ensureAttachRow() {
  let row = document.getElementById("attachRow");
  if (row) return row;

  // Si no existe, lo creamos encima del input
  const footerRow = document.querySelector(".footerRow") || document.querySelector("footer") || document.body;
  row = document.createElement("div");
  row.id = "attachRow";
  row.className = "attachRow";
  row.setAttribute("aria-live", "polite");
  row.innerHTML = `<div class="attachPreview"></div>`;
  footerRow.prepend(row);
  return row;
}

export default function createAttachmentUI({ rootEl, onClear } = {}) {
  const row = rootEl || ensureAttachRow();
  const preview = row.querySelector(".attachPreview") || row;

  // DOM estable (nada de “texto suelto”)
  preview.innerHTML = `
    <div class="fileCard attachCard" role="status">
      <div class="fileCardIcon" aria-hidden="true"><span class="fileTile">FILE</span></div>
      <div class="fileCardMeta">
        <div class="fileCardName" title=""></div>
        <div class="fileCardLabel"></div>
      </div>
      <button type="button" class="attachClear" aria-label="Quitar adjunto">×</button>
    </div>
  `;

  const card = preview.querySelector(".attachCard");
  const icon = preview.querySelector(".fileCardIcon");
  const tile = preview.querySelector(".fileTile");
  const nameEl = preview.querySelector(".fileCardName");
  const labelEl = preview.querySelector(".fileCardLabel");
  const clearBtn = preview.querySelector(".attachClear");

  let lastMeta = null;
  let isSending = false;

  clearBtn.addEventListener("click", () => {
    hide();
    try { onClear?.(); } catch {}
  });

  function setClasses(kindKey, state) {
    card.classList.remove("is-loading", "is-ready", "is-pdf", "is-docx", "is-image", "is-file");
    card.classList.add(kindKey ? `is-${kindKey}` : "is-file");
    card.classList.add(state === "loading" ? "is-loading" : "is-ready");
  }

  function renderIcon(meta) {
    // Si es imagen y tenemos dataUrl -> miniatura real
    if (meta.fileDataUrl && meta.kind.key === "image") {
      icon.innerHTML = `<img class="attachThumb" alt="" />`;
      icon.querySelector("img").src = meta.fileDataUrl;
      return;
    }

    // (PDF miniatura real = caro/fragil. Ahora: tile tipo ChatGPT)
    const txt = meta.kind.label || "FILE";
    icon.innerHTML = `<span class="fileTile" aria-hidden="true">${txt}</span>`;
  }

  function normalize(fileOrMeta, opts = {}) {
    const meta =
      fileOrMeta && typeof fileOrMeta === "object" && ("file" in fileOrMeta || "fileName" in fileOrMeta)
        ? { ...fileOrMeta }
        : { file: fileOrMeta };

    const file = meta.file || null;
    const fileName = meta.fileName || opts.fileName || file?.name || "";
    const fileMime = meta.fileMime || opts.fileMime || file?.type || "";

    const out = {
      file,
      fileName,
      fileMime,
      fileDataUrl: meta.fileDataUrl || opts.fileDataUrl || null,
      state: meta.state || opts.state || "ready",
    };
    out.kind = guessKind({ name: out.fileName, type: out.fileMime });
    return out;
  }

  function show(fileOrMeta, opts = {}) {
    const meta = normalize(fileOrMeta, opts);
    lastMeta = meta;

    row.style.display = "flex";
    row.classList.add("show");
    row.classList.toggle("is-sending", !!isSending);

    setClasses(meta.kind.key, meta.state);

    nameEl.textContent = clampName(meta.fileName);
    nameEl.title = meta.fileName || "";

    labelEl.textContent = meta.kind.label;

    renderIcon(meta);
  }

  function hide() {
    row.style.display = "none";
    row.classList.remove("show", "is-sending");
    icon.innerHTML = `<span class="fileTile" aria-hidden="true">FILE</span>`;
    nameEl.textContent = "";
    nameEl.title = "";
    labelEl.textContent = "";
    lastMeta = null;
  }

  function setSending(next) {
    isSending = !!next;
    row.classList.toggle("is-sending", isSending);
  }

  hide();

  return {
    show,
    hide,
    showAttachPreview: show,
    hideAttachPreview: hide,
    setSending,
    getMeta: () => lastMeta,
    clear: hide,
    reflowPreview: () => {},
  };
}
