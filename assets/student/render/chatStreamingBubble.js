// chatStreamingBubble.js — burbuja de streaming SSE del tutor (crearla
// vacía, añadirle tokens, cerrarla con el HTML+KaTeX final) — extraída de
// chatRenderer.js, mismo patrón que escalationNotice.js, para dejarle
// margen real bajo las 400 líneas. Sin estado compartido con el resto
// del renderer: solo necesita chatList/scrollEl/isNearBottom.
let _thinkingCSSInjected = false;
function _injectThinkingCSS() {
  if (_thinkingCSSInjected) return;
  _thinkingCSSInjected = true;
  const style = document.createElement("style");
  style.textContent = `
.bubble--thinking { background: transparent !important; box-shadow: none !important; display: flex; align-items: center; gap: 5px; padding: 10px 14px; min-height: 36px; }
.thinking-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #c4834a; flex-shrink: 0; animation: td-thinking 1.2s ease-in-out infinite; }
.thinking-dot:nth-child(2) { animation-delay: .2s; }
.thinking-dot:nth-child(3) { animation-delay: .4s; }
@keyframes td-thinking { 0%,60%,100%{ transform:translateY(0); opacity:.45; } 30%{ transform:translateY(-6px); opacity:1; } }
`;
  document.head.appendChild(style);
}

// startStreamingBubble() crea la burbuja del tutor vacía y devuelve { bub, row }.
// appendStreamToken(bub, token) añade un token al texto crudo (muestra cursor ▍).
// finalizeStreamingBubble(bub, fullText) renderiza HTML + KaTeX al terminar.
export function createStreamingBubble({ chatList, scrollEl, isNearBottom }) {
  function startStreamingBubble() {
    _injectThinkingCSS();

    const row  = document.createElement("div");
    row.className = "row a";

    const wrap = document.createElement("div");
    wrap.className = "bubble-wrap";

    const bub = document.createElement("div");
    bub.className = "bubble bubble--streaming bubble--thinking";
    bub.dataset.rawStream = "";
    bub.innerHTML = `<span class="thinking-dot"></span><span class="thinking-dot"></span><span class="thinking-dot"></span>`;

    const ts = document.createElement("div");
    ts.className = "bubble-ts";
    const hhmm = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    ts.textContent = `${hhmm} · Tutor`;

    wrap.appendChild(bub);
    wrap.appendChild(ts);

    const av = document.createElement("div");
    av.className = "bubble-av tutor-av";
    av.textContent = "T";
    av.setAttribute("aria-hidden", "true");

    row.appendChild(av);
    row.appendChild(wrap);

    const nearBottom = isNearBottom(140);
    chatList.appendChild(row);

    if (nearBottom) {
      requestAnimationFrame(() => {
        try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
      });
    }

    return { bub, row };
  }

  function appendStreamToken(bub, token) {
    if (!bub) return;
    const current = bub.dataset.rawStream || "";
    bub.dataset.rawStream = current + token;
    if (!current) {
      // Primer token — salir del modo "pensando" y mostrar texto
      bub.classList.remove("bubble--thinking");
    }
    bub.textContent = bub.dataset.rawStream + "▍";

    // Scroll suave si el alumno está cerca del final
    if (isNearBottom(180)) {
      requestAnimationFrame(() => {
        try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
      });
    }
  }

  function finalizeStreamingBubble(bub, fullText) {
    if (!bub) return;
    bub.classList.remove("bubble--streaming");
    delete bub.dataset.rawStream;

    const safe = String(fullText || "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll("\n", "<br>");
    bub.innerHTML = safe;

    if (window.renderMathInElement) {
      renderMathInElement(bub, {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
      });
    }
  }

  return { startStreamingBubble, appendStreamToken, finalizeStreamingBubble };
}
