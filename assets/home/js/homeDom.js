// Captura todas las referencias al DOM del flujo home en un único punto —
// el resto de módulos reciben `dom` como parámetro explícito en vez de
// volver a consultar el documento por su cuenta.
export function getHomeDom() {
  const $ = (id) => document.getElementById(id);
  return {
    portalCard: $("portalCard"),
    stepLogin: $("stepLogin"),
    stepSignup: $("stepSignup"),
    stepReset: $("stepReset"),
    stepTenantSelect: $("stepTenantSelect"),
    stepJoinTenant: $("stepJoinTenant"),
    stepRole: $("stepRole"),
    stepPendingApproval: $("stepPendingApproval"),

    loginEmail: $("loginEmail"),
    loginPassword: $("loginPassword"),
    loginBtn: $("loginBtn"),
    signupToggle: $("signupToggle"),
    loginError: $("loginError"),

    signupEmail: $("signupEmail"),
    signupPassword: $("signupPassword"),
    signupBtn: $("signupBtn"),
    signupBack: $("signupBack"),
    signupError: $("signupError"),

    tenantSelect: $("tenantSelect"),
    tenantContinue: $("tenantContinue"),
    tenantSelectError: $("tenantSelectError"),
    tenantName2: $("tenantName2"),

    tenantJoinCode: $("tenantJoinCode"),
    studentCourseSelect: $("studentCourseSelect"),
    tenantJoinBtn: $("tenantJoinBtn"),
    tenantJoinError: $("tenantJoinError"),
    tenantJoinLogout: $("tenantJoinLogout"),

    enterStudent: $("enterStudent"),
    enterTeacher: $("enterTeacher"),
    logoutBtn: $("logoutBtn"),
    pendingApprovalText: $("pendingApprovalText"),
    pendingApprovalReload: $("pendingApprovalReload"),
    pendingApprovalLogout: $("pendingApprovalLogout"),

    resetError: $("resetError"),
    resetEmail: $("resetEmail"),
    resetBtn: $("resetBtn"),
    forgotToggle: $("forgotToggle"),
    resetBack: $("resetBack"),
  };
}
