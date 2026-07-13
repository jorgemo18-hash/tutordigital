// assets/app/render/chatRenderer.js
// Chat rendering helpers extracted from index.js to keep index.js small.

import { createEscalationNotice } from "./escalationNotice.js";

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

export function createChatRenderer({
  chatList,
  scrollEl,
  looksMath,
  asciiToLatex,
  getHistory,
  setHistory,
  shouldAutoScroll,
  getStudentInitials = () => "?",
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

  function autoScrollEnabled(meta = {}) {
    try {
      if (typeof shouldAutoScroll === "function") return !!shouldAutoScroll(meta);
    } catch {}
    return true;
  }

  function isMathOnly(raw = "") {
    const t = String(raw || "").trim();
    if (!t) return false;

    const lm = typeof looksMath === "function" ? !!looksMath(t) : false;
    if (!lm) return false;

    const hasMathSignal =
      /[+\-*/^=√π]/.test(t) || /\b(sqrt|sin|cos|tan|log|ln)\b/i.test(t);
    if (!hasMathSignal) return false;

    if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/.test(t)) {
      return false;
    }

    return true;
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

  function anchorToRow(row, { paddingTop = 16 } = {}) {
    try {
      if (!row) return;
      const top = row.offsetTop;
      const target = Math.max(0, top - paddingTop);
      const diff = Math.abs(scrollEl.scrollTop - target);
      if (diff > 8) scrollEl.scrollTop = target;
    } catch {}
  }

  function looksLikeUrl(s) {
    return /^(https?:\/\/)/i.test(String(s || "").trim());
  }

  function getFileInfoFromText(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;

    if (looksLikeUrl(s)) {
      try {
        const u = new URL(s);
        const p = (u.pathname || "").toLowerCase();
        let kind = null;
        if (p.endsWith(".pdf")) kind = "pdf";
        if (p.endsWith(".doc") || p.endsWith(".docx")) kind = "docx";
        if (!kind) return null;
        const nameRaw = (u.pathname.split("/").pop() || "archivo").replace(/\+/g, "%20");
        const name = decodeURIComponent(nameRaw);
        return { kind, name, url: s };
      } catch {
        // si no es URL válida, seguimos al modo filename
      }
    }

    const lower = s.toLowerCase();
    if (lower.endsWith(".pdf")) return { kind: "pdf", name: s };
    if (lower.endsWith(".doc") || lower.endsWith(".docx")) return { kind: "docx", name: s };
    return null;
  }

  function truncateMiddle(str, max = 36) {
    const s = String(str || "");
    if (s.length <= max) return s;
    const keep = Math.max(10, Math.floor((max - 3) / 2));
    return s.slice(0, keep) + "..." + s.slice(-keep);
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function add(role, text, opts = {}) {
    const row = document.createElement("div");
    row.className = "row " + (role === "user" ? "u" : "a");
    if (opts?.pinned) row.dataset.pinned = "1";

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
      const fileInfo = getFileInfoFromText(raw);

      if (fileInfo) {
        bub.classList.add("is-file", fileInfo.kind === "pdf" ? "is-pdf" : "is-docx");
        bub.innerHTML = "";

        const label = fileInfo.kind === "pdf" ? "PDF" : "DOC";
        const pill = el("span", `filePill filePill--${fileInfo.kind}`, label);
        const nameSpan = el("span", "filePillName", truncateMiddle(fileInfo.name, 42));
        bub.appendChild(pill);
        bub.appendChild(nameSpan);

        if (fileInfo.url) {
          bub.classList.add("is-link");
          bub.tabIndex = 0;
          const open = () => {
            try { window.open(fileInfo.url, "_blank", "noopener,noreferrer"); } catch {}
          };
          bub.addEventListener("click", open);
          bub.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              open();
            }
          });
        }
      } else if (window.katex && isMathOnly(raw)) {
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
        if (isMathOnly(raw)) bub.dataset.rawMath = raw;
      }
    }

    // Timestamp
    const ts = document.createElement("div");
    ts.className = "bubble-ts";
    const hhmm = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    ts.textContent = role !== "user" ? `${hhmm} · Tutor` : hhmm;

    // Bubble wrap
    const wrap = document.createElement("div");
    wrap.className = "bubble-wrap";
    wrap.appendChild(bub);
    wrap.appendChild(ts);

    // Avatar
    const av = document.createElement("div");
    av.className = role !== "user" ? "bubble-av tutor-av" : "bubble-av student-av";
    av.textContent = role !== "user" ? "T" : getStudentInitials();
    av.setAttribute("aria-hidden", "true");

    if (role !== "user") {
      row.appendChild(av);
      row.appendChild(wrap);
    } else {
      row.appendChild(wrap);
      row.appendChild(av);
    }

    const autoScroll =
      opts?.autoScroll !== false && autoScrollEnabled({ phase: "add", role, text });
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
            const bubbleH = bub.getBoundingClientRect
              ? bub.getBoundingClientRect().height
              : 0;
            const viewportH = scrollEl?.clientHeight || 0;
            if (bubbleH && viewportH && bubbleH > viewportH * 0.6) {
              // Respuesta larga: mostrar el inicio del mensaje.
              anchorToRow(row, { paddingTop: 16 });
            } else {
              // Respuesta normal: mantener visible el inicio del ultimo mensaje del usuario.
              anchorToLastUserRow({ paddingTop: 16 });
            }
          } else {
            // Para mensajes del usuario, ir al final tiene sentido.
            scrollEl.scrollTop = scrollEl.scrollHeight;
          }
        } catch {}
      });
    }

    return row;
  }

  function addTeacherCTA(type, { onClick, autoScroll } = {}) {
    if (!chatList) return null;

    const row = document.createElement("div");
    row.className = "row a";

    const card = document.createElement("div");
    card.className = "bubble teacherCTACard";
    card.setAttribute("data-cta", type === "review" ? "review" : "help");

    const title = document.createElement("div");
    title.className = "teacherCTATitle";
    title.textContent = type === "review" ? "Enviar a revisión" : "Pedir ayuda al profesor";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "teacherCTABtn";
    btn.textContent = type === "review" ? "Enviar a revisión" : "Pedir ayuda al profesor";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      btn.disabled = true;
      if (typeof onClick === "function") onClick({ type, btn });
    });

    card.appendChild(title);
    card.appendChild(btn);
    row.appendChild(card);

    const allowAuto = autoScroll !== false && autoScrollEnabled({ phase: "cta" });
    const nearBottom = allowAuto && isNearBottom(140);
    chatList.appendChild(row);

    if (nearBottom) {
      requestAnimationFrame(() => {
        try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
      });
    }

    return row;
  }

  function addTopicChips(items = [], { onSelect, autoScroll } = {}) {
    if (!chatList) return null;
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (list.length === 0) return null;

    const row = document.createElement("div");
    row.className = "row a";

    const card = document.createElement("div");
    card.className = "bubble topicCard";

    const title = document.createElement("div");
    title.className = "topicTitle";
    title.textContent = "¿Por dónde empezamos?";

    const chips = document.createElement("div");
    chips.className = "topicChips";

    list.forEach((raw) => {
      const text = String(raw || "").trim();
      if (!text) return;
      const parts = text.split("·").map((p) => p.trim()).filter(Boolean);
      const subject = parts[0] || text;
      const detail = parts.slice(1).join(" · ");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "topicChip";
      btn.textContent = subject;
      btn.dataset.subject = subject;
      btn.dataset.detail = detail;
      btn.dataset.full = text;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        btn.disabled = true;
        if (typeof onSelect === "function") {
          onSelect({
            subject,
            detail,
            full: text,
            btn,
            row,
          });
        }
      });

      chips.appendChild(btn);
    });

    card.appendChild(title);
    card.appendChild(chips);
    row.appendChild(card);

    const allowAuto = autoScroll !== false && autoScrollEnabled({ phase: "topicChips" });
    const nearBottom = allowAuto && isNearBottom(140);
    chatList.appendChild(row);

    if (nearBottom) {
      requestAnimationFrame(() => {
        try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
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

    if (autoScrollEnabled({ phase: "image", role: "user" }) && isNearBottom(140)) {
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

  function addFileAttachment({ name = "", kind = "file", thumbDataUrl = null, href = "" } = {}) {
    const row = document.createElement("div");
    row.className = "row u";

    const bub = document.createElement("div");
    bub.className = "bubble fileCard";

    const icon = document.createElement("div");
    icon.className = `fileCardIcon is-${kind}`;

    if (thumbDataUrl) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = thumbDataUrl;
      icon.appendChild(img);
    } else {
      icon.textContent = kind === "pdf" ? "PDF" : kind === "docx" ? "DOC" : "FILE";
    }

    const meta = document.createElement("div");
    meta.className = "fileCardMeta";

    const title = document.createElement("div");
    title.className = "fileCardName";
    title.textContent = name || (kind === "pdf" ? "PDF" : kind === "docx" ? "DOCX" : "Archivo");

    const label = document.createElement("div");
    label.className = "fileCardLabel";
    label.textContent = kind === "pdf" ? "PDF" : kind === "docx" ? "DOCX" : "ARCHIVO";

    meta.appendChild(title);
    meta.appendChild(label);

    bub.appendChild(icon);
    bub.appendChild(meta);

    if (href) {
      bub.classList.add("is-link");
      bub.tabIndex = 0;
      const open = () => {
        try { window.open(href, "_blank", "noopener,noreferrer"); } catch {}
      };
      bub.addEventListener("click", open);
      bub.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    }

    row.appendChild(bub);
    chatList.appendChild(row);

    if (autoScrollEnabled({ phase: "file", role: "user" }) && isNearBottom(140)) {
      requestAnimationFrame(() => {
        try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
      });
    }

    __lastUserRow = row;
    __lastUserWasImage = false;

    try {
      const hist = typeof getHistory === "function" ? getHistory() : [];
      const tag = kind === "pdf" ? "PDF" : kind === "docx" ? "DOCX" : "ARCHIVO";
      hist.push({ role: "user", content: `📎 ${tag} adjunto: ${name || tag}` });
      typeof setHistory === "function" && setHistory(hist);
    } catch {}

    return row;
  }

  function renderFromHistory() {
    const nodes = Array.from(chatList?.children || []);
    nodes.forEach((node) => {
      if (node?.dataset?.pinned === "1") return;
      try { node.remove(); } catch {}
    });

    const hist = typeof getHistory === "function" ? getHistory() : [];
    if (!Array.isArray(hist) || hist.length === 0) return;

    for (const m of hist) {
      const role = m.role === "assistant" ? "assistant" : "user";
      const content = String(m?.content || "");

      if (role === "user" && /^📎\s*Imagen\s+adjunta:/i.test(content)) {
        add("user", "📎 Imagen adjunta", { autoScroll: false });
        continue;
      }

      add(role, content, { autoScroll: false });
    }

    if (autoScrollEnabled({ phase: "history" })) {
      requestAnimationFrame(() => {
        try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
      });
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
    if (!autoScrollEnabled({ phase: "scrollToBottom" })) return;
    try {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    } catch {}
  }

  // ── Streaming bubble ────────────────────────────────────────────────────
  // startStreamingBubble() crea la burbuja del tutor vacía y devuelve { bub, row }.
  // appendStreamToken(bub, token) añade un token al texto crudo (muestra cursor ▍).
  // finalizeStreamingBubble(bub, fullText) renderiza HTML + KaTeX al terminar.

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

  const { addEscalationNotice } = createEscalationNotice({ chatList, scrollEl, isNearBottom, autoScrollEnabled });

  return {
    add,
    addTeacherCTA,
    addTopicChips,
    addEscalationNotice,
    addImageAttachment,
    addFileAttachment,
    renderFromHistory,
    rerenderPendingMath,
    setLastUserRow,
    anchorToLastUserRow,
    scrollToBottom,
    startStreamingBubble,
    appendStreamToken,
    finalizeStreamingBubble,
  };
}
