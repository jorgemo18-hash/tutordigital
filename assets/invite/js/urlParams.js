// Lectura y limpieza de estado de sesión/params en la URL. Extraído literal
// de invite.html — parseInviteParams() agrupa lo que antes eran variables
// sueltas de módulo (tenant/prefillEmail/token/role/groupId/existing/
// pkceCode), consumidas por closure en cada función del script inline.
import { setSessionTokens } from "/assets/shared/js/auth.js";

export function parseInviteParams() {
  const qs = new URLSearchParams(location.search);
  return {
    tenant: qs.get("tenant") || "",
    prefillEmail: qs.get("email") || "",
    token: qs.get("token") || "",
    role: qs.get("role") || "teacher", // "student" | "teacher"
    groupId: qs.get("group") || "", // solo flujo alumno
    existing: qs.get("existing") === "1", // alumno ya tenía cuenta Supabase
    pkceCode: qs.get("code") || "",
  };
}

export function consumeSessionFromUrl() {
  const hashRaw = String(window.location.hash || "");
  const searchRaw = String(window.location.search || "");
  const fromHash = hashRaw.startsWith("#") ? hashRaw.slice(1) : hashRaw;
  const hashParams = new URLSearchParams(fromHash);
  const queryParams = new URLSearchParams(searchRaw);

  const accessToken = hashParams.get("access_token") || queryParams.get("access_token") || "";
  const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token") || "";
  const expiresAtRaw = hashParams.get("expires_at") || queryParams.get("expires_at") || "";
  const expiresInRaw = hashParams.get("expires_in") || queryParams.get("expires_in") || "";
  const urlType = hashParams.get("type") || queryParams.get("type") || "";

  if (!accessToken) return { consumed: false, type: "" };

  const expiresAt = Number(expiresAtRaw || 0) || null;
  const expiresIn = Number(expiresInRaw || 0) || null;
  const computedExpiresAt = expiresAt || (expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : null);

  setSessionTokens({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
    expires_at: computedExpiresAt || undefined,
  });

  // Limpiar tokens sensibles de la URL (query y hash)
  window.history.replaceState(
    {},
    document.title,
    window.location.pathname +
      window.location.search
        .replace(/([?&])(access_token|refresh_token|expires_at|expires_in)=[^&]*/g, "")
        .replace(/\?&/, "?")
        .replace(/\?$/, "")
  );
  return { consumed: true, type: urlType };
}
