// assets/app/render/push.js
// Helper para pintar mensajes y persistir historial sin repetir lógica.

export function createPusher({ add, getHistory, setHistory } = {}) {
  const debug = (() => {
    try { return localStorage.getItem("ttd_debug") === "1"; } catch {}
    return false;
  })();

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
      const MAX = 200;
      setHistory(h.slice(-MAX));
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
