// Canje de la invitación — dos ramas según params.role. Extraído literal de
// invite.html. Se llama tras un login/signup exitoso (authFlows.js) o
// directamente si ya había sesión (uiFlows.js, flujo genérico).
import { apiFetch, getAccessToken, setActiveTenantSlug } from "/assets/shared/js/auth.js";

export async function redeemInvite(params, ui) {
  const { tenant, token, role, groupId } = params;
  const { showResult, showMessage, showRedirectBar } = ui;

  if (!tenant) {
    showResult("⚠️", "URL no válida", "Falta el identificador del centro en la URL.");
    showMessage("resultMsg", "Pide al admin que te envíe un enlace válido.");
    return;
  }
  if (!token) {
    showResult("⚠️", "URL no válida", "Falta el token de seguridad en la URL.");
    showMessage("resultMsg", "Pide al admin que te envíe un enlace válido.");
    return;
  }
  setActiveTenantSlug(tenant);

  if (!getAccessToken()) {
    showResult("🔒", "Sin sesión", "No se ha podido iniciar sesión. Refresca la página e inténtalo de nuevo.");
    return;
  }

  if (role === "student") {
    showResult("⏳", "Activando acceso…", "Estamos configurando tu acceso a la clase.");
    if (!groupId) {
      showResult("⚠️", "URL no válida", "Falta el identificador del grupo en la URL.");
      showMessage("resultMsg", "Pide al admin que te envíe un enlace válido.");
      return;
    }
    try {
      const res = await apiFetch("/api/v1/student/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, group_id: groupId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || "No se pudo activar el acceso.");
      }
      const data = await res.json().catch(() => ({}));
      const route = data?.data?.route || "/assets/student/";
      showResult("🎉", "¡Ya eres parte de la clase!", "Tu acceso ha sido activado correctamente.");
      showRedirectBar();
      setTimeout(() => { location.href = route; }, 2000);
    } catch (e) {
      showResult("❌", "Error al activar", e?.message || "No se pudo activar el acceso.");
      showMessage("resultMsg", "Si el problema persiste, contacta con el admin de tu centro.");
    }
    return;
  }

  // Teacher flow
  showResult("⏳", "Activando acceso…", "Estamos configurando tu perfil de docente.");
  try {
    const res = await apiFetch("/api/v1/teacher/invite/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || "No se pudo activar el acceso.");
    }
    const data = await res.json().catch(() => ({}));
    const route = data?.data?.route || "/assets/teacher/";
    showResult("🎉", "¡Acceso activado!", "Tu perfil de docente se ha creado correctamente.");
    showRedirectBar();
    setTimeout(() => { location.href = route; }, 2000);
  } catch (e) {
    showResult("❌", "Error al activar", e?.message || "No se pudo canjear el código.");
    showMessage("resultMsg", "Si el problema persiste, contacta con el admin de tu centro.");
  }
}
