import { getAccessToken, apiFetch, clearSession, setSessionTokens, setActiveTenantSlug } from "../../shared/js/auth.js";
import { showStep } from "./homeUi.js";
import { setMemberships, getMemberships } from "./homeMembershipsState.js";
import { isActiveMembership, tenantSlugOf, isStudentPendingMembership } from "./homeMembershipUtils.js";
import { routeForTenant, fillTenantSelect, showStudentPendingStep } from "./homeRouting.js";

export async function loadMemberships() {
  const token = getAccessToken();
  if (!token) return { ok: false };
  const res = await apiFetch("/api/v1/me");
  if (!res.ok) {
    clearSession();
    return { ok: false };
  }
  const data = await res.json();
  const memberships = Array.isArray(data?.data?.memberships) ? data.data.memberships : [];
  setMemberships(memberships);
  return { ok: true, memberships, user: data?.data?.user || null };
}

export async function proceedAfterAuth(dom) {
  let result = await loadMemberships();
  if (!result.ok) {
    showStep(dom, "login");
    return;
  }

  if (result.user?.is_superadmin === true) {
    try { localStorage.setItem("ttd_activeRole", "superadmin"); } catch {}
    window.location.href = "/assets/superadmin/";
    return;
  }

  if (result.user?.must_change_password === true) {
    window.location.href = "/change-password.html";
    return;
  }

  // Retry once if no memberships found, to allow auto-redeem to finish
  if (getMemberships().length === 0) {
    await new Promise((r) => setTimeout(r, 800));
    result = await loadMemberships();
    if (getMemberships().length === 0) {
      // Still no memberships? Then it's a new user (student flow)
      showStep(dom, "join");
      return;
    }
  }

  const memberships = getMemberships();
  const active = memberships.filter(isActiveMembership);
  const activeTenantSlugs = Array.from(new Set(active.map(tenantSlugOf).filter(Boolean)));
  if (activeTenantSlugs.length > 1) {
    fillTenantSelect(dom, active);
    showStep(dom, "tenant");
    return;
  }

  if (activeTenantSlugs.length === 1) {
    routeForTenant(dom, activeTenantSlugs[0], memberships);
    return;
  }

  const pendingStudent = memberships.find(isStudentPendingMembership);
  if (pendingStudent) {
    const slug = tenantSlugOf(pendingStudent);
    if (slug) setActiveTenantSlug(slug);
    showStudentPendingStep(dom, pendingStudent);
    return;
  }

  showStep(dom, "join");
}

export async function handleExistingSession(dom) {
  // Detectar sesión desde hash o query de URL (Supabase magic link / confirmación)
  const hashRaw = String(window.location.hash || "");
  const searchRaw = String(window.location.search || "");
  const fromHash = hashRaw.startsWith("#") ? hashRaw.slice(1) : hashRaw;
  const hashParams = new URLSearchParams(fromHash);
  const queryParams = new URLSearchParams(searchRaw);

  const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");
  const expiresAtRaw = hashParams.get("expires_at") || queryParams.get("expires_at");
  const expiresInRaw = hashParams.get("expires_in") || queryParams.get("expires_in");
  if (accessToken) {
    const expiresAt = Number(expiresAtRaw || 0) || null;
    const expiresIn = Number(expiresInRaw || 0) || null;
    setSessionTokens({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
      expires_at: expiresAt || (expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : undefined),
    });
    window.history.replaceState(null, "", window.location.pathname);
  }

  const token = getAccessToken();
  if (!token) {
    showStep(dom, "login");
    return;
  }
  await proceedAfterAuth(dom);
}
