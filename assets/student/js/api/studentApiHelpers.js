export function getDebugFlag() {
  try {
    const qs = String(window.location.search || "");
    if (/(?:\?|&)debug=1(?:&|$)/.test(qs)) {
      try { localStorage.setItem("ttd_debug", "1"); } catch {}
      return true;
    }
    try { return localStorage.getItem("ttd_debug") === "1"; } catch {}
  } catch {}
  return false;
}
