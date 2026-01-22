// /assets/home/home.js

(function () {
  const mq = window.matchMedia("(max-width: 768px)");

  function init() {
    const $ = (id) => {
      const el = document.getElementById(id);
      if (!el) console.warn(`home.js: no existe #${id}`);
      return el;
    };

    const openBtn     = $("openChat");
    const overlay     = $("overlay");
    const frame       = $("chatFrame");

    const minimizeBtn = $("minimizeChat");
    const closeBtn    = $("closeChat");

    const miniBar     = $("miniBar");
    const miniClose   = $("miniClose");

    const miniInput   = $("miniInput");
    const miniOpen    = $("miniOpen");
    const miniMax     = $("miniMax");

    const padOutside  = $("padOutside");

    const STORAGE_KEY = "ttutordigital_chat_state";

    const isMobile = () => mq.matches;

    function setState(v) {
      try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
    }

    function getState() {
      try { return localStorage.getItem(STORAGE_KEY) || "closed"; }
      catch (e) { return "closed"; }
    }

    function sendToChat(type, payload = {}) {
      if (!frame || !frame.contentWindow) return;
      if (typeof type === "string") {
        frame.contentWindow.postMessage({ type, ...payload }, "*");
      } else {
        frame.contentWindow.postMessage(type, "*");
      }
    }

    function setAriaHidden(el, hidden) {
      if (!el) return;
      el.setAttribute("aria-hidden", hidden ? "true" : "false");
    }

    function showOverlay(show) {
      if (!overlay) return;
      overlay.classList.toggle("open", !!show);
      setAriaHidden(overlay, !show);
    }

    function showMiniBar(show) {
      if (!miniBar) return;
      miniBar.style.display = show ? "flex" : "none";
      setAriaHidden(miniBar, !show);
    }

    function openChat() {
      if (isMobile()) {
        window.location.href = "./app.html";
        return;
      }

      if (!overlay) return;

      showOverlay(true);
      showMiniBar(false);

      setState("open");
      sendToChat("focusInput");
    }

    function minimizeChat() {
      if (!overlay) return;

      showOverlay(false);

      if (padOutside) padOutside.classList.remove("show");

      if (!isMobile()) showMiniBar(true);

      setState("minimized");
    }

    function closeChat() {
      if (!overlay) return;

      showOverlay(false);

      // resetea posición del modal (opcional)
      try {
        const modal = overlay.querySelector(".modal");
        if (modal) {
          modal.dataset.x = "0";
          modal.dataset.y = "0";
          modal.style.transform = "";
        }
      } catch (e) {}

      if (padOutside) padOutside.classList.remove("show");

      showMiniBar(false);

      setState("closed");
    }

    function sendMiniText() {
      const text = (miniInput?.value || "").trim();

      if (!text) {
        openChat();
        return;
      }

      openChat();

      sendToChat("sendText", { text });

      if (miniInput) miniInput.value = "";
    }

    // ---------- Eventos básicos ----------
    openBtn && openBtn.addEventListener("click", openChat);
    minimizeBtn && minimizeBtn.addEventListener("click", minimizeChat);
    closeBtn && closeBtn.addEventListener("click", closeChat);

    miniClose && miniClose.addEventListener("click", closeChat);
    miniOpen && miniOpen.addEventListener("click", sendMiniText);
    // Maximizar (solo abre el chat, sin enviar)
    miniMax && miniMax.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openChat();
    });

    miniInput && miniInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendMiniText();
      }
    });

    overlay && overlay.addEventListener("click", (e) => {
      if (e.target === overlay) minimizeChat();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") minimizeChat();
    });

    // ---------- Drag del modal (solo desktop) ----------
    (function setupDrag() {
      if (!overlay) return;
      const modal = overlay.querySelector(".modal");
      const handle = overlay.querySelector(".modalTop");
      if (!modal || !handle) return;

      let dragging = false;
      let startX = 0, startY = 0;
      let baseX = 0, baseY = 0;

      function getModalXY() {
        const x = Number(modal.dataset.x || 0);
        const y = Number(modal.dataset.y || 0);
        return { x, y };
      }

      function setModalXY(x, y) {
        modal.dataset.x = String(x);
        modal.dataset.y = String(y);
        modal.style.transform = `translate(${x}px, ${y}px)`;
      }

      handle.addEventListener("pointerdown", (e) => {
        if (e.target && e.target.closest("button")) return;
        dragging = true;
        try { handle.setPointerCapture(e.pointerId); } catch {}
        startX = e.clientX;
        startY = e.clientY;
        const { x, y } = getModalXY();
        baseX = x;
        baseY = y;
      });

      handle.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        setModalXY(baseX + dx, baseY + dy);
      });

      handle.addEventListener("pointerup", () => { dragging = false; });
      handle.addEventListener("pointercancel", () => { dragging = false; });
    })();

    // ---------- Mensajes desde el iframe ----------
    window.addEventListener("message", (event) => {
      if (!event.data) return;
      if (event.data.type === "togglePad") {
        if (!padOutside) return;
        padOutside.classList.toggle("show");
      }
    });

    // ---------- Click en teclado externo ----------
    padOutside && padOutside.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (!b) return;

      let value = b.dataset.i;

      if (value === "×") value = "*";
      if (value === "÷") value = "/";
      if (value === "−") value = "-";

      if (value === "√()" || value === "√") {
        sendToChat("insert", { value: "sqrt()" });
        sendToChat("moveCursor", { offset: -1 });
        return;
      }

      if (value === "/") {
        sendToChat("insert", { value: "()/()" });
        sendToChat("moveCursor", { offset: -4 });
        return;
      }

      sendToChat("insert", { value });
    });

    // ---------- Restaurar estado (sin autoabrir) ----------
    window.addEventListener("load", () => {
      if (isMobile()) return;

      const state = getState();

      if (state === "minimized") {
        showOverlay(false);
        showMiniBar(true);
      } else {
        showOverlay(false);
        showMiniBar(false);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
