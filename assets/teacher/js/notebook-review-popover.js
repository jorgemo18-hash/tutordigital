// notebook-review-popover.js — lista desplegable de sesiones pendientes de
// revisión, anclada al badge del Cuaderno. Mismo patrón que
// notebook-weight-popover.js (singleton posicionado dentro de .panelHeader).
// No importa session-drawer.js/tickets.js a propósito — recibe onSelect como
// dependencia explícita, la abre quien la llama (modals.js).
import { escHtml } from "../../shared/js/escHtml.js";
import { fmtDateFromKey } from "./session-drawer-render.js";

let _popover = null;
let _popoverAbort = null;

function getOrCreatePopover(containerEl) {
  if (_popover) {
    if (_popover.parentElement !== containerEl) containerEl.appendChild(_popover);
    return _popover;
  }
  const el = document.createElement("div");
  el.className = "nbReviewPopover";
  containerEl.appendChild(el);
  _popover = el;
  return el;
}

function closeReviewPopover() {
  if (_popover) _popover.classList.remove("open");
  if (_popoverAbort) { _popoverAbort.abort(); _popoverAbort = null; }
}

function _positionPopover(pop, anchorEl, containerEl) {
  const anchorRect    = anchorEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();
  const top  = anchorRect.bottom - containerRect.top + 6;
  const left = anchorRect.left - containerRect.left;
  pop.style.top  = `${top}px`;
  pop.style.left = `${Math.max(8, Math.min(left, containerEl.clientWidth - 260))}px`;
}

function openReviewPopover(anchorEl, items, { onSelect } = {}) {
  const containerEl = anchorEl.closest(".panelHeader") || anchorEl.parentElement;
  const pop = getOrCreatePopover(containerEl);
  _positionPopover(pop, anchorEl, containerEl);

  pop.innerHTML = `
    <div class="nbReviewHead">
      <span class="nbReviewTitle">Pendientes de revisión</span>
      <button class="nbReviewClose" type="button" aria-label="Cerrar">✕</button>
    </div>
    <div class="nbReviewList">
      ${items.map(item => `
        <button class="nbReviewItem" type="button" data-session-id="${escHtml(item.sessionId)}">
          <span class="nbReviewItemName">${escHtml(item.studentName)}</span>
          <span class="nbReviewItemMeta">${escHtml(item.taskTitle)}${item.sessionDate ? ` · ${escHtml(fmtDateFromKey(item.sessionDate))}` : ""}</span>
        </button>
      `).join("")}
    </div>`;

  pop.classList.add("open");

  const ac = new AbortController();
  _popoverAbort = ac;

  pop.querySelector(".nbReviewClose").addEventListener("click", closeReviewPopover, { signal: ac.signal });

  pop.querySelectorAll(".nbReviewItem").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = items.find(i => i.sessionId === btn.dataset.sessionId);
      closeReviewPopover();
      if (item) onSelect?.(item);
    }, { signal: ac.signal });
  });

  setTimeout(() => {
    document.addEventListener("click", e => {
      if (!pop.contains(e.target) && e.target !== anchorEl) closeReviewPopover();
    }, { once: true, signal: ac.signal });
  }, 0);
}

export { openReviewPopover, closeReviewPopover };
