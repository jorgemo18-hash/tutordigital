// /assets/home/home.js

(function () {
  const mq = window.matchMedia("(max-width: 768px)");

  function init() {
    const openBtn     = document.getElementById("openChat");
    const overlay     = document.getElementById("overlay");
    const frame       = document.getElementById("chatFrame");

    const minimizeBtn = document.getElementById("minimizeChat");
    const closeBtn    = document.getElementById("closeChat");

    const miniBar     = document.getElementById("miniBar");
    const miniClose   = document.getElementById("miniClose");

    const miniInput   = document.getElementById("miniInput");
    const miniOpen    = document.getElementById("miniOpen");

    const padOutside  = document.getElementById("padOutside");

    const STORAGE_KEY = "ttutordigital_chat_state";

    const isMobile = () => mq.matches;

    function setState(v) {
      try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
    }

    function getState() {
      try { return localStorage.getItem(STORAGE_KEY) || "closed"; }
      catch (e) { return "closed"; }
    }

    function focusChatInput() {
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage("focusInput", "*");
      }
    }

    function openChat() {
      if (isMobile()) {
        window.location.href = "./app.html";
        return;
      }

      if (!overlay) return;

      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");

      if (miniBar) {
        miniBar.style.display = "none";
        miniBar.setAttribute("aria-hidden", "true");
      }

      setState("open");
      focusChatInput();
    }

    function minimizeChat() {
      if (!overlay) return;

      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");

      if (padOutside) padOutside.classList.remove("show");

      if (!isMobile() && miniBar) {
        miniBar.style.display = "flex";
        miniBar.setAttribute("aria-hidden", "false");
      }

      setState("minimized");
    }

    function closeChat() {
      if (!overlay) return;

      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");

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

      if (miniBar) {
        miniBar.style.display = "none";
        miniBar.setAttribute("aria-hidden", "true");
      }

      setState("closed");
    }

    function sendMiniText() {
      const text = (miniInput?.value || "").trim();

      if (!text) {
        openChat();
        return;
      }

      openChat();

      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: "sendText", text }, "*");
      }

      if (miniInput) miniInput.value = "";
    }

    // ---------- Eventos básicos ----------
    openBtn && openBtn.addEventListener("click", openChat);
    minimizeBtn && minimizeBtn.addEventListener("click", minimizeChat);
    closeBtn && closeBtn.addEventListener("click", closeChat);

    miniClose && miniClose.addEventListener("click", closeChat);
    miniOpen && miniOpen.addEventListener("click", sendMiniText);

    miniInput && miniInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMiniText();
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
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: "insert", value: "sqrt()" }, "*");
          frame.contentWindow.postMessage({ type: "moveCursor", offset: -1 }, "*");
        }
        return;
      }

      if (value === "/") {
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: "insert", value: "()/()" }, "*");
          frame.contentWindow.postMessage({ type: "moveCursor", offset: -4 }, "*");
        }
        return;
      }

      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: "insert", value }, "*");
      }
    });

    // ---------- Restaurar estado (sin autoabrir) ----------
    window.addEventListener("load", () => {
      if (isMobile()) return;

      const state = getState();

      if (state === "minimized") {
        overlay && overlay.classList.remove("open");
        overlay && overlay.setAttribute("aria-hidden", "true");
        if (miniBar) {
          miniBar.style.display = "flex";
          miniBar.setAttribute("aria-hidden", "false");
        }
      } else {
        closeChat();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();