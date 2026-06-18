// mobileTeacherPerfil.js — Profile tab for the mobile teacher panel.
// Below the existing account card it now also hosts "Configurar pesos",
// the light/dark toggle, and "Cerrar sesión" (replacing the old standalone
// logout button) as a tappable row list.

import { openSheet, closeSheet } from "./mobileTeacherSheets.js";
import { renderMobileWeightsSheet } from "./weights/mobileWeightsSheet.js";
import { getTheme, saveTheme } from "../../shared/js/header.js";

const SVG_LOGOUT = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
const SVG_GEAR   = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const SVG_MOON   = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SVG_SUN    = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function _initials(name) {
  const p = String(name || "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : p[0]?.[0] || "?").toUpperCase();
}

export function initMtPerfil({ pageEl, headerEl, mtState, ctx, apiFetch, sheetEl, backdropEl, onLogout }) {
  function _buildHeader() {
    headerEl.innerHTML = `
      <div class="mt-header-eyebrow">PERFIL</div>
      <h1 class="mt-header-title"><em>Mi</em> cuenta</h1>`;
  }

  function _openWeights() {
    const contentEl = sheetEl.querySelector("#mtSheetContent");
    renderMobileWeightsSheet({
      contentEl, apiFetch, groupId: mtState.currentGroupId,
      onClose: () => closeSheet(sheetEl, backdropEl),
    });
    openSheet(sheetEl, backdropEl);
  }

  function _render() {
    _buildHeader();

    const name   = ctx.state?.currentTeacherName || "";
    const groups = mtState.groups;
    const groupsHtml = groups.length
      ? `<ul class="mt-perfil-groups">${groups.map(g => `<li>${_esc(g.name)}</li>`).join("")}</ul>`
      : "<span>—</span>";

    const isLight = getTheme() === "light";

    const perfil = document.createElement("div");
    perfil.className = "mt-perfil";
    perfil.innerHTML = `
      <div class="mt-perfil-avatar">${_esc(_initials(name))}</div>
      <div class="mt-perfil-name">${_esc(name || "Profesor")}</div>
      <div class="mt-perfil-role">Profesor</div>
      <div class="mt-perfil-card">
        <div class="mt-perfil-row">
          <span class="mt-perfil-row-key">Grupos</span>
          <div class="mt-perfil-row-val">${groupsHtml}</div>
        </div>
        <div class="mt-perfil-row">
          <span class="mt-perfil-row-key">Curso</span>
          <span class="mt-perfil-row-val">2025 – 2026</span>
        </div>
      </div>
      <div class="mt-perfil-card mt-perfil-options">
        <button type="button" class="mt-perfil-option" id="mtOptWeights">${SVG_GEAR}<span>Configurar pesos</span></button>
        <button type="button" class="mt-perfil-option" id="mtOptTheme">${isLight ? SVG_MOON : SVG_SUN}<span>Modo ${isLight ? "oscuro" : "claro"}</span></button>
        <button type="button" class="mt-perfil-option mt-perfil-option--danger" id="mtOptLogout">${SVG_LOGOUT}<span>Cerrar sesión</span></button>
      </div>`;

    pageEl.innerHTML = "";
    pageEl.appendChild(perfil);

    pageEl.querySelector("#mtOptWeights").addEventListener("click", _openWeights);
    pageEl.querySelector("#mtOptTheme").addEventListener("click", () => {
      saveTheme(isLight ? "dark" : "light");
      _render();
    });
    pageEl.querySelector("#mtOptLogout").addEventListener("click", onLogout);
  }

  _render();
}
