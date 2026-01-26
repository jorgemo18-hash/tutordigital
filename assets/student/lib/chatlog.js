import { warn } from "./log.js";

export function pushMessage(deps, role, content, opts) {
  const { add, getHistory, setHistory } = deps || {};
  const r = role === "assistant" ? "assistant" : "user";
  const msg = String(content ?? "");

  try { add?.(r, msg, opts); } catch (e) { warn("chatlog:add", e); }

  try {
    if (typeof getHistory === "function" && typeof setHistory === "function") {
      const hist = getHistory() || [];
      hist.push({ role: r, content: msg });
      // NO recortes aquí. Si quieres límite, que sea posterior y explícito.
      setHistory(hist);
    }
  } catch (e) {
    warn("chatlog:history", e);
  }
}

export const pushUser = (deps, content, opts) => pushMessage(deps, "user", content, opts);
export const pushAssistant = (deps, content, opts) => pushMessage(deps, "assistant", content, opts);
