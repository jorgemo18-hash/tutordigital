// mobileTeacherPerfil.js — Profile tab for the mobile teacher panel.

const SVG_LOGOUT = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function _initials(name) {
  const p = String(name || "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : p[0]?.[0] || "?").toUpperCase();
}

export function initMtPerfil({ pageEl, headerEl, mtState, ctx, onLogout }) {
  function _buildHeader() {
    headerEl.innerHTML = `
      <div class="mt-header-eyebrow">PERFIL</div>
      <h1 class="mt-header-title"><em>Mi</em> cuenta</h1>`;
  }

  function _render() {
    _buildHeader();

    const name   = ctx.state?.currentTeacherName || "";
    const groups = mtState.groups;
    const groupNames = groups.map(g => g.name).join(", ") || "—";

    const perfil = document.createElement("div");
    perfil.className = "mt-perfil";
    perfil.innerHTML = `
      <div class="mt-perfil-avatar">${_esc(_initials(name))}</div>
      <div class="mt-perfil-name">${_esc(name || "Profesor")}</div>
      <div class="mt-perfil-role">Profesor</div>
      <div class="mt-perfil-card">
        <div class="mt-perfil-row">
          <span class="mt-perfil-row-key">Grupos</span>
          <span class="mt-perfil-row-val">${_esc(groupNames)}</span>
        </div>
        <div class="mt-perfil-row">
          <span class="mt-perfil-row-key">Curso</span>
          <span class="mt-perfil-row-val">2025 – 2026</span>
        </div>
      </div>
      <button class="mt-logout-btn" id="mtLogoutBtn">${SVG_LOGOUT} Cerrar sesión</button>`;

    pageEl.innerHTML = "";
    pageEl.appendChild(perfil);

    pageEl.querySelector("#mtLogoutBtn").addEventListener("click", onLogout);
  }

  _render();
}
