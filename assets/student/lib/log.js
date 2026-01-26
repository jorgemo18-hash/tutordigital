export function DEBUG() {
  try { return localStorage.getItem("ttd_debug") === "1"; } catch {}
  return false;
}

export function warn(scope, err, extra) {
  if (!DEBUG()) return;
  try { console.warn(`[${scope}]`, err, extra || ""); } catch {}
}

export function info(scope, msg, extra) {
  if (!DEBUG()) return;
  try { console.log(`[${scope}]`, msg, extra || ""); } catch {}
}
