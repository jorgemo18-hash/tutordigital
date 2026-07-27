// chatPromptCards.js — tarjetas de "acción sugerida" del chat (CTA hacia
// el profesor, chips de tema para elegir por dónde empezar) — extraídas
// de chatRenderer.js, mismo patrón que escalationNotice.js, para dejarle
// margen real bajo las 400 líneas. Sin estado compartido con el resto
// del renderer (a diferencia de add()/addImageAttachment, no tocan
// __lastUserRow): solo necesitan chatList/scrollEl/isNearBottom/autoScrollEnabled.
export function createChatPromptCards({ chatList, scrollEl, isNearBottom, autoScrollEnabled }) {
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

  return { addTeacherCTA, addTopicChips };
}
