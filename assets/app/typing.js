// assets/app/typing.js
/**
 * Crea un indicador de "escribiendo..." dentro del chat.
 * @param {Object} opts
 * @param {HTMLElement} opts.chatList
 * @param {HTMLElement} opts.scrollEl
 * @param {string} [opts.template] - HTML interno del bubble
 * @param {boolean} [opts.debug=false]
 */
export function createTyping({ chatList, scrollEl, template, debug = false } = {}) {
  let typingRow = null;

  const tpl =
    template ||
    `<div class="typingDots"><span></span><span></span><span></span></div>`;

  function scrollToBottom() {
    try {
      if (!scrollEl) return;
      scrollEl.scrollTop = scrollEl.scrollHeight;
    } catch {}
  }

  function isTyping() {
    return !!typingRow;
  }

  function showTyping() {
    if (!chatList || typingRow) return;
    if (debug) console.log("[typing] show");
    try {
      const row = document.createElement("div");
      row.className = "row a";
      row.innerHTML = `<div class="bubble">${tpl}</div>`;
      typingRow = row;
      chatList.appendChild(row);
      scrollToBottom();
    } catch (e) {
      typingRow = null;
      if (debug) console.warn("[typing] show failed", e);
    }
  }

  function hideTyping() {
    if (!typingRow) return;
    if (debug) console.log("[typing] hide");
    try {
      typingRow.remove();
    } catch {}
    typingRow = null;
  }

  return { showTyping, hideTyping, isTyping };
}