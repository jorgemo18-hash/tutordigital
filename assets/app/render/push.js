// assets/app/render/push.js
// Helper para pintar mensajes y persistir historial sin repetir lógica.

export function createPusher({ add, getHistory, setHistory } = {}) {
  const debug = (() => {
    try { return localStorage.getItem("ttd_debug") === "1"; } catch {}
    return false;
  })();
  const MAX_HISTORY = 1200;

  function push(role, text, opts) {
    const content = String(text || "");
    if (!content) return;

    try {
      if (typeof add === "function") add(role, content, opts);
    } catch (err) {
      if (debug) console.warn("[pusher] add() failed", err);
    }

    try {
      if (typeof getHistory !== "function" || typeof setHistory !== "function") return;
      const h = getHistory();
      h.push({ role, content });
      if (h.length > MAX_HISTORY) {
        h.splice(0, h.length - MAX_HISTORY);
      }
      setHistory(h);
    } catch (err) {
      if (debug) console.warn("[pusher] history failed", err);
    }
  }

  function pushAssistant(text, opts) {
    push("assistant", text, opts);
  }

  function pushUser(text, opts) {
    push("user", text, opts);
  }

  return { push, pushAssistant, pushUser };
}
