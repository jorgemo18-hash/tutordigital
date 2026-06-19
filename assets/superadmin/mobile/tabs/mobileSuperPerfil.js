// mobileSuperPerfil.js — Tab Perfil: avatar + nombre real del superadmin,
// rol, accesos (plataforma/bandeja/curso), cerrar sesión.

import { icon } from "../../../admin/mobile/mobileAdminIcons.js";

const INBOX_URL = "https://email.ionos.es/appsuite/#!!&app=io.ox/mail&folder=default0/INBOX";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _initials(name) {
  const p = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : p[0]?.[0] || "?").toUpperCase();
}

export function renderSuperPerfil({ containerEl, adminName, tenantsCount, onLogout }) {
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
      </div>
      <button type="button" class="logout" id="spLogoutBtn">${icon("exit", { size: 18 })} Cerrar sesión</button>
    </div>`;

  containerEl.querySelector("#spLogoutBtn").addEventListener("click", () => {
    if (confirm("¿Cerrar sesión?")) onLogout();
  });
}
