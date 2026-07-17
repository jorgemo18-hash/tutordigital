import { getHomeDom } from "./js/homeDom.js";
import { showStep, setError, populateStudentCourseSelect } from "./js/homeUi.js";
import { getMemberships } from "./js/homeMembershipsState.js";
import { enterAs } from "./js/homeRouting.js";
import { handleExistingSession } from "./js/homeAuthFlow.js";
import { handleLogin, handleSignup, handleReset, handleLogout } from "./js/homeAuthActions.js";
import { handleTenantContinue, handleTenantJoin } from "./js/homeTenantActions.js";
import { showSessionExpiredNoticeIfAny } from "./js/homeSessionExpiredNotice.js";

(function () {
  const dom = getHomeDom();

  dom.loginBtn?.addEventListener("click", () => handleLogin(dom));
  dom.loginEmail?.addEventListener("input", () => setError(dom.loginError, ""));
  dom.loginPassword?.addEventListener("input", () => setError(dom.loginError, ""));
  dom.loginPassword?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      handleLogin(dom);
    }
  });

  dom.tenantContinue?.addEventListener("click", () => handleTenantContinue(dom));
  dom.tenantSelect?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      handleTenantContinue(dom);
    }
  });

  dom.enterStudent?.addEventListener("click", () => enterAs(dom, getMemberships(), "student"));
  dom.enterTeacher?.addEventListener("click", () => enterAs(dom, getMemberships(), "teacher"));
  dom.logoutBtn?.addEventListener("click", () => handleLogout(dom));
  dom.signupToggle?.addEventListener("click", () => showStep(dom, "signup"));
  dom.signupBack?.addEventListener("click", () => showStep(dom, "login"));
  dom.forgotToggle?.addEventListener("click", () => showStep(dom, "reset"));
  dom.resetBack?.addEventListener("click", () => showStep(dom, "login"));
  dom.resetBtn?.addEventListener("click", () => handleReset(dom));
  dom.resetEmail?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); handleReset(dom); }
  });
  dom.signupBtn?.addEventListener("click", () => handleSignup(dom));
  dom.tenantJoinBtn?.addEventListener("click", () => handleTenantJoin(dom));
  dom.tenantJoinLogout?.addEventListener("click", () => handleLogout(dom));
  dom.pendingApprovalLogout?.addEventListener("click", () => handleLogout(dom));

  populateStudentCourseSelect(dom);
  handleExistingSession(dom);
  showSessionExpiredNoticeIfAny(dom);
})();
