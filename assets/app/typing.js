// assets/app/typing.js
// Dots "escribiendo..." (siempre dentro de #messages)

export function createTyping({ chatList, scrollEl } = {}) {
  let typingRow = null;

  function showTyping() {
    if (!chatList) return;
    if (typingRow) return;

    typingRow = document.createElement("div");
    typingRow.className = "row a";

    const bub = document.createElement("div");
    bub.className = "bubble";
    bub.innerHTML = '<div class="typingDots"><span></span><span></span><span></span></div>';

    typingRow.appendChild(bub);
    chatList.appendChild(typingRow);

    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function hideTyping() {
    if (!typingRow) return;
    try { typingRow.remove(); } catch {}
    typingRow = null;
  }

  return { showTyping, hideTyping };
}