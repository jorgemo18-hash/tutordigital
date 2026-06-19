// mobileSuperMas.js — Tab Más: bloque de perfil (avatar + nombre + rol),
// filas de cuenta (Plataforma · Bandeja · Curso · Tema) y cerrar sesión.
// Mismo mecanismo de tema (getTheme/saveTheme) que el admin móvil
// (assets/admin/mobile/tabs/mobileAdminMas.js).

import { getTheme, saveTheme } from "../../../shared/js/header.js";
import { icon } from "../../../admin/mobile/mobileAdminIcons.js";

const INBOX_URL = "https://email.ionos.es/appsuite/#!!&app=io.ox/mail&folder=default0/INBOX";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

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
          <a class="prow" id="spInboxRow" href="${INBOX_URL}" target="_blank" rel="noopener">
            <span class="prow-ic">${icon("inbox", { size: 20 })}</span>
            <div class="prow-text">
              <div class="prow-label">Bandeja</div>
              <div class="prow-value">Acceder al correo</div>
            </div>
          </a>
          <div class="prow">
            <span class="prow-ic">${icon("cal", { size: 20 })}</span>
            <div class="prow-text">
              <div class="prow-label">Curso</div>
              <div class="prow-value">2025 – 2026</div>
            </div>
          </div>
          <button type="button" class="prow" id="spThemeBtn">
            <span class="prow-ic">${icon(isLight ? "moon" : "sun", { size: 20 })}</span>
            <div class="prow-text">
              <div class="prow-label">Tema</div>
              <div class="prow-value">Modo ${isLight ? "oscuro" : "claro"}</div>
            </div>
          </button>
        </div>
        <button type="button" class="logout" id="spLogoutBtn">${icon("exit", { size: 18 })} Cerrar sesión</button>
      </div>`;

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
