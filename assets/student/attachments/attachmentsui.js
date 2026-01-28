import { getFileKind } from "../lib/files.js";

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function truncateMiddle(str = "", max = 36) {
  const s = String(str);
  if (s.length <= max) return s;
  const keep = Math.max(10, Math.floor((max - 3) / 2));
  return `${s.slice(0, keep)}...${s.slice(-keep)}`;
}

function iconSvg(kind) {
  if (kind === "docx") {
    return `
      <svg class="apIconSvg" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M6 2h7l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5L13 3.5z"/>
      </svg>
    `;
  }
  return `
    <svg class="apIconSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M6 2h7l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5L13 3.5z"/>
    </svg>
  `;
}

function kindLabel(kind) {
  if (kind === "pdf") return "PDF";
  if (kind === "docx") return "DOCX";
  if (kind === "image") return "IMG";
  return "FILE";
}

/**
 * Renderiza la preview del adjunto en el composer.
 * @param {{
 *  rootEl: HTMLElement,
 *  attachState: { get(): any, clear(): void },
 *  onClear?: () => void
 * }} opts
 */
export function createAttachmentUI({ rootEl, attachState, onClear } = {}) {
  if (!rootEl) throw new Error("createAttachmentUI: rootEl requerido");
  if (!attachState?.get || !attachState?.clear) {
    throw new Error("createAttachmentUI: attachState.get/clear requeridos");
  }

  const previewWrap = document.createElement("div");
  previewWrap.className = "attachPreviewWrap";
  rootEl.appendChild(previewWrap);

  function clearPreview() {
    previewWrap.innerHTML = "";
    previewWrap.style.display = "none";
  }

  function render() {
    const a = attachState.get();
    if (!a) return clearPreview();

    const file = a.file;
    const dataUrl = a.dataUrl || a.imageDataUrl || a.previewDataUrl || "";
    const name = a.fileName || file?.name || "adjunto";
    const kindInfo = file ? getFileKind(file) : { kind: a.kind || "unknown" };
    const kind = kindInfo.kind || "unknown";

    previewWrap.style.display = "";

    const safeName = escapeHtml(truncateMiddle(name, 46));

    const previewEl = document.createElement("div");
    previewEl.className = "attachPreview";

    if (kind === "image" && dataUrl) {
      previewEl.innerHTML = `
        <div class="apThumb" aria-hidden="true">
          <img src="${dataUrl}" alt="" />
        </div>
        <div class="apName" title="${escapeHtml(name)}">${safeName}</div>
        <button class="apRemove" type="button" aria-label="Quitar adjunto">×</button>
      `;
    } else {
      const label = kindLabel(kind);
      previewEl.innerHTML = `
        <div class="apIcon apIcon--${escapeHtml(kind)}" aria-hidden="true">
          ${iconSvg(kind)}
          <div class="apIconLabel">${escapeHtml(label)}</div>
        </div>
        <div class="apName" title="${escapeHtml(name)}">${safeName}</div>
        <button class="apRemove" type="button" aria-label="Quitar adjunto">×</button>
      `;
    }

    previewWrap.innerHTML = "";
    previewWrap.appendChild(previewEl);

    const btn = previewEl.querySelector(".apRemove");
    btn?.addEventListener("click", () => {
      attachState.clear();
      onClear?.();
      clearPreview();
    });
  }

  return {
    render,
    clear: clearPreview,
  };
}
