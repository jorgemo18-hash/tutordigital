// ── Wiring de acciones del sidebar ──────────────────────────────────────────
// Logout, toggle de tema, barra de "volver al superadmin" (impersonación),
// botones "Ver como" y apertura del modal de soporte. Extraído literal de
// admin.js — todo wiring de un solo uso sobre ids fijos del sidebar, sin
// interdependencias entre sí. Recibe `logout` e `initSupportModalFn` como
// parámetros explícitos en vez de importarlos (son los mismos que ya
// importa admin.js para el resto del panel).

function wireLogout(logout) {
  document.getElementById("avLogoutBtn")?.addEventListener("click", async () => {
    await logout();
    window.location.href = "/login";
  });
}

function wireThemeToggle() {
  function syncThemeBtn() {
    const isDark = document.documentElement.dataset.theme !== "light";
    const label = document.querySelector("#avThemeToggle .td-theme-label");
    if (label) label.textContent = isDark ? "Modo claro" : "Modo oscuro";
  }

  document.getElementById("avThemeToggle")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("ttdTheme", next); } catch {}
    syncThemeBtn();
  });

  syncThemeBtn();
}

function wireImpersonationBar() {
  const isImpersonating = new URLSearchParams(window.location.search).get("impersonating") === "true";
  if (!isImpersonating) return;
  const bar = document.getElementById("avSuperadminBar");
  if (!bar) return;
  bar.style.display = "";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "btn ghost btn-back-superadmin";
  backBtn.textContent = "← Volver al superadmin";
  backBtn.addEventListener("click", () => {
    if (window.opener) { window.close(); }
    else { window.location.href = "https://tutordigital.app/assets/superadmin/index.html"; }
  });
  bar.appendChild(backBtn);
}

function wireSupportModal(initSupportModalFn) {
  const support = initSupportModalFn();
  document.getElementById("avHelpBtn")?.addEventListener("click", () => support.open());
}

function wireViewAsButtons() {
  const viewRoles = [
    { id: "avBtnViewTeacher", role: "teacher", url: "/assets/teacher/" },
    { id: "avBtnViewStudent", role: "student", url: "/assets/student/" },
  ];
  for (const vr of viewRoles) {
    const btn = document.getElementById(vr.id);
    if (!btn) continue;
    btn.style.display = "";
    btn.addEventListener("click", () => {
      try {
        localStorage.setItem("ttd_activeRole", vr.role);
        localStorage.setItem("ttd_admin_return", "1");
      } catch {}
      window.location.href = vr.url;
    });
  }
}

export function wireSidebarActions({ logout, initSupportModalFn }) {
  wireLogout(logout);
  wireThemeToggle();
  wireImpersonationBar();
  wireSupportModal(initSupportModalFn);
  wireViewAsButtons();
}
