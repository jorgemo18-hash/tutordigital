// ── Auth callback processing (magic link / impersonation) ──────────────────
// Extraído literal de admin.js.
import { setActiveTenantSlug, setSessionTokens } from "../../shared/js/auth.js";

export async function processAuthCallback() {
  const qs   = new URLSearchParams(window.location.search);
  const code  = qs.get("code") || "";
  const hash  = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const hashP = new URLSearchParams(hash);
  const accessToken = hashP.get("access_token") || "";

  // Si el callback incluye el slug del tenant (impersonación), fijarlo ahora
  // antes de cualquier API call para que getTenantSlug() devuelva el valor correcto.
  const tenantFromUrl = qs.get("tenant") || "";
  if (tenantFromUrl) setActiveTenantSlug(tenantFromUrl);

  if (code) {
    // PKCE: intercambiar el código por una sesión via el endpoint existente
    try {
      const res = await fetch("/api/v1/auth/exchange-invite-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json().catch(() => ({}));
      const d = body?.data || {};
      if (d.access_token) {
        setSessionTokens({
          access_token:  d.access_token,
          refresh_token: d.refresh_token || undefined,
          expires_at:    d.expires_at    || undefined,
        });
      }
    } catch (e) {
      console.error("[admin] exchange code failed:", e);
    }
    // Limpiar el ?code= de la URL (mantener ?impersonating= y ?tenant= si están)
    const clean = new URLSearchParams(window.location.search);
    clean.delete("code");
    const newSearch = clean.toString() ? "?" + clean.toString() : "";
    window.history.replaceState({}, document.title, window.location.pathname + newSearch);
    return;
  }

  if (accessToken) {
    // Implicit: token en el hash
    const refreshToken = hashP.get("refresh_token") || "";
    const expiresAt    = Number(hashP.get("expires_at") || 0) || null;
    const expiresIn    = Number(hashP.get("expires_in") || 0) || null;
    setSessionTokens({
      access_token:  accessToken,
      refresh_token: refreshToken || undefined,
      expires_at:    expiresAt || (expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : undefined),
    });
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }
}
