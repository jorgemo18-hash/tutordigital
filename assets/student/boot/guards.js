function installMicGuards({ stopMic } = {}) {
  try {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        try { stopMic?.(); } catch {}
      }
    });

    window.addEventListener("blur", () => {
      try { stopMic?.(); } catch {}
    });
  } catch {}
}

function installBackStopsMic({ stopMic } = {}) {
  try {
    const backBtn = document.querySelector("header .back");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        try { stopMic?.(); } catch {}
      });
    }
  } catch {}
}

function installEnterToSend({ inp, safeSend } = {}) {
  try {
    if (inp && !inp.dataset.ttdEnterSend) {
      inp.dataset.ttdEnterSend = "1";
      inp.addEventListener("keydown", (e) => {
        // Enter envía; Shift+Enter hace salto de línea
        if (e.key === "Enter" && !e.shiftKey) {
          // Evita interferir con IME / composición
          if (e.isComposing) return;
          e.preventDefault();
          try { safeSend?.(); } catch {}
        }
      });
    }
  } catch {}
}

export { installMicGuards, installBackStopsMic, installEnterToSend };
