// Intercambio de código PKCE por sesión — Supabase redirige con ?code= en
// vez de #access_token= en algunos flujos. Extraído literal del bloque que
// estaba embebido al inicio de init() en invite.html.
import { apiFetch, setSessionTokens } from "/assets/shared/js/auth.js";

export async function exchangePkceCode(params) {
  if (!params.pkceCode || !params.token) return false;
  try {
    const xres = await apiFetch("/api/v1/auth/exchange-invite-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: params.pkceCode }),
    });
    const xbody = await xres.json().catch(() => ({}));
    if (xres.ok && xbody?.data?.access_token) {
      setSessionTokens({
        access_token: xbody.data.access_token,
        refresh_token: xbody.data.refresh_token,
        expires_at: xbody.data.expires_at,
      });
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname +
          window.location.search
            .replace(/([?&])code=[^&]*/g, "")
            .replace(/\?&/, "?")
            .replace(/\?$/, "")
      );
      return true;
    }
  } catch (_) {
    // Si el intercambio falla caemos al flujo manual
  }
  return false;
}
