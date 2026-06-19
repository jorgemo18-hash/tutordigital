// mobileAdminMas.js — Tab Más: cuenta (nombre + email), modo claro/oscuro,
// cerrar sesión. Mismo mecanismo de tema que el panel profesor móvil
// (assets/teacher/mobile/mobileTeacherPerfil.js).

import { getTheme, saveTheme } from "../../../shared/js/header.js";
import { icon } from "../mobileAdminIcons.js";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _initials(name, email) {
  const p = String(name || email || "?").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : p[0]?.[0] || "?").toUpperCase();
}

export function renderAdminMas({ containerEl, adminName, adminEmail, onLogout }) {
  function _draw() {
    const isLight = getTheme() === "light";

    containerEl.innerHTML = `
      <div class="phead">
        <div class="phead-eyebrow">Cuenta</div>
        <h1 class="phead-title"><em>Más</em></h1>
      </div>
      <div class="dash">
        <div class="gblock">
          <div class="doc-head">
            <div class="pav lg">${_esc(_initials(adminName, adminEmail))}</div>
            <div class="pinfo">
              <span class="pname">${_esc(adminName || "Director")}</span>
              <span class="pmail">${_esc(adminEmail || "")}</span>
            </div>
          </div>
        </div>
        <div class="gblock optlist">
          <button type="button" class="optrow" id="adMThemeBtn">${icon(isLight ? "moon" : "sun", { size: 17 })}<span>Modo ${isLight ? "oscuro" : "claro"}</span></button>
          <button type="button" class="optrow optrow--danger" id="adMLogoutBtn">${icon("logout", { size: 17 })}<span>Cerrar sesión</span></button>
        </div>
      </div>`;

    containerEl.querySelector("#adMThemeBtn").addEventListener("click", () => {
      saveTheme(isLight ? "dark" : "light");
      _draw();
    });
    containerEl.querySelector("#adMLogoutBtn").addEventListener("click", () => {
      if (confirm("¿Cerrar sesión?")) onLogout();
    });
  }

  _draw();
}
