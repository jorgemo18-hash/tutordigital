<file name=assets/app/attachments/attachmentsui.js>
// assets/app/attachments/attachmentsui.js
export function createAttachmentUI({
  inp,
  update,
  onClear,
}) {
  const attachRow = document.getElementById("attachRow");
  const attachRowEl = attachRow;

  const __footerEl = document.querySelector("footer");
  function __setHasAttach(on) {
    try {
      if (__footerEl) __footerEl.classList.toggle("hasAttach", !!on);
    } catch {}
  }
  function __syncHasAttachFromDOM() {
    try {
      const has = !!(attachRow && attachRow.children && attachRow.children.length);
      __setHasAttach(has);
    } catch {}
  }

  function showAttachPreview(attachment) {
    if (!attachRow) return;
    attachRow.innerHTML = "";
    attachRow.setAttribute("aria-hidden", "false");

    const thumb = document.createElement("img");
    thumb.src = attachment.thumb || attachment.dataURL || "";
    thumb.alt = attachment.name || "Attachment preview";
    thumb.style.maxHeight = "40px";
    thumb.style.borderRadius = "6px";
    thumb.style.flexShrink = "0";

    const filename = document.createElement("span");
    filename.textContent = attachment.name || "";
    filename.style.flexGrow = "1";
    filename.style.overflow = "hidden";
    filename.style.textOverflow = "ellipsis";
    filename.style.whiteSpace = "nowrap";
    filename.style.userSelect = "text";
    filename.style.marginLeft = "8px";

    attachRow.appendChild(thumb);
    attachRow.appendChild(filename);

    __setHasAttach(true);
  }

  function hideAttachPreview() {
    if (!attachRow) return;
    attachRow.innerHTML = "";
    attachRow.setAttribute("aria-hidden", "true");

    __setHasAttach(false);
  }

  function reflowPreview() {
    // Potentially re-layout or reflow preview elements
    // (implementation depends on actual code, here just syncing)
    __syncHasAttachFromDOM();
  }

  return {
    showAttachPreview,
    hideAttachPreview,
    reflowPreview,
  };
}
</file>

<file name=assets/app/app.css>
/* === Composer: preview integrado tipo ChatGPT cuando hay adjunto === */
footer #attachRow { display: none; }
footer.hasAttach #attachRow { display: flex; }

footer.hasAttach #attachRow {
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 14px;
  background: rgba(0,0,0,0.03);
  margin-bottom: 10px;
  max-width: 100%;
  overflow: hidden;
}

/* Que el textarea se “sienta” más grande cuando hay adjunto */
footer.hasAttach .inpWrap {
  margin-top: 0;
}

footer.hasAttach #inp {
  min-height: 64px; /* base más alta; el autogrow seguirá funcionando */
}

/* Ajustes para móvil: que no se coma espacio y el preview no se desborde */
@media (max-width: 520px) {
  footer.hasAttach #attachRow {
    padding: 10px;
    border-radius: 12px;
  }
  footer.hasAttach #inp {
    min-height: 58px;
  }
}
</file>
