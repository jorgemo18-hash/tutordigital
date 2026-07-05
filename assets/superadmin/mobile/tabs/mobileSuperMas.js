// mobileSuperMas.js — Tab Más: bloque de perfil (avatar + nombre + rol),
// filas informativas (Plataforma · Curso) y acciones con el mismo peso
// visual (Bandeja · Modo claro/oscuro · Cerrar sesión). Mismo mecanismo de
// tema (getTheme/saveTheme) que el admin móvil
// (assets/admin/mobile/tabs/mobileAdminMas.js).

import { getTheme, saveTheme } from "../../../shared/js/header.js";
import { icon } from "../../../admin/mobile/mobileAdminIcons.js";
import { escHtml as _esc } from "../../../shared/js/escHtml.js";

const INBOX_URL = "https://email.ionos.es/appsuite/#!!&app=io.ox/mail&folder=default0/INBOX";

function _initials(name) {
  const p = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : p[0]?.[0] || "?").toUpperCase();
}

export function renderSuperMas({ containerEl, adminName, tenantsCount, onLogout }) {
  function _draw() {
    const isLight = getTheme() === "light";

    containerEl.innerHTML = `
      <div class="profile">
        <div class="profile-card">
          <div class="profile-av">${_esc(_initials(adminName))}</div>
          <div class="profile-name">${_esc(adminName || "Superadmin")}</div>
          <div class="profile-role">Fundador · Superadmin</div>
        </div>
        <div class="profile-rows">
          <div class="prow">
            <span class="prow-ic">${icon("building", { size: 20 })}</span>
            <div class="prow-text">
              <div class="prow-label">Plataforma</div>
              <div class="prow-value">TutorDigital · ${tenantsCount} centro${tenantsCount !== 1 ? "s" : ""}</div>
            </div>
          </div>
          <div class="prow">
            <span class="prow-ic">${icon("cal", { size: 20 })}</span>
            <div class="prow-text">
              <div class="prow-label">Curso</div>
              <div class="prow-value">2025 – 2026</div>
            </div>
          </div>
        </div>
        <div class="acct-actions">
          <button type="button" class="acct-btn" id="spInboxBtn">${icon("inbox", { size: 18 })} Bandeja de correo</button>
          <button type="button" class="acct-btn" id="spThemeBtn">${icon(isLight ? "moon" : "sun", { size: 18 })} Modo ${isLight ? "oscuro" : "claro"}</button>
          <button type="button" class="acct-btn acct-btn--danger" id="spLogoutBtn">${icon("exit", { size: 18 })} Cerrar sesión</button>
        </div>
      </div>`;

    containerEl.querySelector("#spInboxBtn").addEventListener("click", () => {
      window.open(INBOX_URL, "_blank", "noopener");
    });
    containerEl.querySelector("#spThemeBtn").addEventListener("click", () => {
      saveTheme(isLight ? "dark" : "light");
      _draw();
    });
    containerEl.querySelector("#spLogoutBtn").addEventListener("click", () => {
      if (confirm("¿Cerrar sesión?")) onLogout();
    });
  }

  _draw();
}
