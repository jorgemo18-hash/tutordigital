<file name=assets/app/attachments/attachmentsui.js>
// assets/app/attachments/attachmentsui.js

export function createAttachmentUI() {
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

  // ... rest of the function

  function showAttachPreview(attachment) {
    // ... code that sets aria-hidden, innerHTML, appends children, etc.
    if (attachRow) {
      attachRow.setAttribute("aria-hidden", "false");
      attachRow.innerHTML = ""; // example clearing before adding
      // ... code to add preview content
    }

    __setHasAttach(true);
  }

  function hideAttachPreview() {
    if (attachRow) {
      attachRow.setAttribute("aria-hidden", "true");
      attachRow.innerHTML = "";
    }

    __setHasAttach(false);
  }

  if (typeof reflowPreview === "function") {
    const origReflow = reflowPreview;
    reflowPreview = function () {
      origReflow();
      __syncHasAttachFromDOM();
    };
  }

  // ... rest of the function
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
