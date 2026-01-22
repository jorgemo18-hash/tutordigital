// assets/app/render/chatRenderer.js
// Chat rendering helpers extracted from index.js to keep index.js small.

export function createChatRenderer({
  chatList,
  scrollEl,
  looksMath,
  asciiToLatex,
  getHistory,
  setHistory,
} = {}) {
  let __lastUserRow = null;
  let __lastUserWasImage = false;
  function isNearBottom(threshold = 140) {
    try {
      const remaining =
        scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
      return remaining < threshold;
    } catch {
      return true;
    }
  }

  function anchorToLastUserRow({ paddingTop = 16 } = {}) {
    try {
      const anchor = __lastUserRow;
      if (!anchor) return;
      const aTop = anchor.offsetTop;
      const target = Math.max(0, aTop - paddingTop);
      const diff = Math.abs(scrollEl.scrollTop - target);
      if (diff > 8) scrollEl.scrollTop = target;
    } catch {}
  }

  function add(role, text, opts = {}) {
    const row = document.createElement("div");
    row.className = "row " + (role === "user" ? "u" : "a");

    const bub = document.createElement("div");
    bub.className = "bubble";

    if (role === "assistant") {
      const safe = String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
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
    } else {
      const raw = String(text || "");
      if (typeof looksMath === "function" && looksMath(raw) && window.katex) {
        try {
          katex.render(
            typeof asciiToLatex === "function" ? asciiToLatex(raw) : raw,
            bub,
            { throwOnError: false, displayMode: false }
          );
        } catch {
          bub.textContent = raw;
          bub.dataset.rawMath = raw;
        }
      } else {
        bub.textContent = raw;
        if (typeof looksMath === "function" && looksMath(raw)) bub.dataset.rawMath = raw;
      }
    }

    row.appendChild(bub);

    const autoScroll = opts?.autoScroll !== false;
    const nearBottom = autoScroll && isNearBottom(140);

    chatList.appendChild(row);

    if (role === "user") {
      __lastUserRow = row;
      __lastUserWasImage = false;
    }

    if (nearBottom) {
      requestAnimationFrame(() => {
        try {
          if (role === "assistant" && __lastUserWasImage) return;
          if (role === "assistant") {
            // Mantener visible el INICIO del último mensaje del usuario.
            anchorToLastUserRow({ paddingTop: 16 });
          } else {
            // Para mensajes del usuario, ir al final tiene sentido.
            scrollEl.scrollTop = scrollEl.scrollHeight;
          }
        } catch {}
      });
    }

    return row;
  }

  function addImageAttachment(file) {
    const row = document.createElement("div");
    row.className = "row u";

    const bub = document.createElement("div");
    bub.className = "bubble";

    const img = document.createElement("img");
    img.style.width = "84px";
    img.style.height = "84px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "14px";
    img.style.border = "1px solid rgba(0,0,0,.12)";
    img.style.display = "block";

    const url = URL.createObjectURL(file);
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
    };

    bub.appendChild(img);
    row.appendChild(bub);
    chatList.appendChild(row);

    if (isNearBottom(140)) {
      requestAnimationFrame(() => {
        try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
      });
    }

    __lastUserRow = row;
    __lastUserWasImage = true;

    try {
      const hist = typeof getHistory === "function" ? getHistory() : [];
      hist.push({ role: "user", content: `📎 Imagen adjunta: ${file.name}` });
      typeof setHistory === "function" && setHistory(hist);
    } catch {}

    return row;
  }

  function renderFromHistory() {
    chatList.innerHTML = "";

    const hist = typeof getHistory === "function" ? getHistory() : [];
    if (!Array.isArray(hist) || hist.length === 0) return;

    for (const m of hist) {
      const role = m.role === "assistant" ? "assistant" : "user";
      const content = String(m?.content || "");

      if (role === "user" && /^📎\s*Imagen\s+adjunta:/i.test(content)) {
        add("user", "📎 Imagen adjunta");
        continue;
      }

      add(role, content);
    }
  }

  function rerenderPendingMath() {
    if (!window.katex) return;
    const scope = (chatList && typeof chatList.querySelectorAll === "function") ? chatList : document;
    scope.querySelectorAll(".bubble[data-raw-math]").forEach((bub) => {
      const raw = bub.dataset.rawMath || "";
      if (!raw) return;
      try {
        katex.render(
          typeof asciiToLatex === "function" ? asciiToLatex(raw) : raw,
          bub,
          { throwOnError: false, displayMode: false }
        );
        delete bub.dataset.rawMath;
      } catch {}
    });
  }

  function setLastUserRow(el) {
    __lastUserRow = el || null;
  }

  function scrollToBottom() {
    try {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    } catch {}
  }

  return {
    add,
    addImageAttachment,
    renderFromHistory,
    rerenderPendingMath,
    setLastUserRow,
    anchorToLastUserRow,
    scrollToBottom,
  };
}
