import { apiFetch, setActiveTenantSlug } from "../../shared/js/auth.js";
import { setError } from "./homeUi.js";
import { getMemberships } from "./homeMembershipsState.js";
import { normalizeStatus, tenantSlugOf, isStudentPendingMembership } from "./homeMembershipUtils.js";
import { routeForTenant, showStudentPendingStep } from "./homeRouting.js";
import { proceedAfterAuth } from "./homeAuthFlow.js";

export function handleTenantContinue(dom) {
  setError(dom.tenantSelectError, "");
  const slug = String(dom.tenantSelect?.value || "").trim();
  if (!slug) {
    setError(dom.tenantSelectError, "Selecciona un centro.");
    return;
  }
  routeForTenant(dom, slug, getMemberships());
}

export async function handleTenantJoin(dom) {
  setError(dom.tenantJoinError, "");
  const course = String(dom.studentCourseSelect?.value || "").trim();
  const joinCode = String(dom.tenantJoinCode?.value || "").trim();
  if (!course) {
    setError(dom.tenantJoinError, "Selecciona tu curso.");
    return;
  }
  if (!joinCode) {
    setError(dom.tenantJoinError, "Introduce el código de centro.");
    return;
  }
  const res = await apiFetch("/api/v1/tenant/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ join_code: joinCode, course }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    setError(dom.tenantJoinError, data?.error?.message || "Código incorrecto.");
    return;
  }
  const tenant = data?.data?.tenant;
  if (tenant?.slug) {
    setActiveTenantSlug(tenant.slug);
    if (dom.tenantName2) dom.tenantName2.textContent = tenant.name || tenant.slug;
  }
  try { localStorage.setItem("ttd_activeRole", "student"); } catch {}

  const approvalStatus = normalizeStatus(data?.data?.approval_status || "pending");
  const membershipStatus = normalizeStatus(data?.data?.membership_status || "pending");
  if (approvalStatus === "approved" && membershipStatus === "active") {
    window.location.href = "/assets/student/index.html";
    return;
  }
  await proceedAfterAuth(dom);
  const memberships = getMemberships();
  const pendingMembership =
    memberships.find((m) => tenantSlugOf(m) === tenantSlugOf({ tenant }) && isStudentPendingMembership(m)) ||
    memberships.find(isStudentPendingMembership) ||
    memberships[0] ||
    null;
  showStudentPendingStep(dom, pendingMembership);
}
