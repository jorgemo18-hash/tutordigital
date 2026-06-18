// mobileAdminProfes.js — Tab Profes.: teacher list (expandable subjects per
// group), "+ Invitar" sheet, and tap-to-edit via the existing desktop
// teacherDrawer singleton (ctx.teacherDrawer — same overlay, same endpoint).

import { fetchTeachers, fetchGroups } from "../mobileAdminData.js";
import { openSheet, closeSheet } from "../mobileAdminSheets.js";
import { renderTeacherInviteSheet } from "../teachers/mobileTeacherInviteSheet.js";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _initials(name, email) {
  const words = String(name || email || "?").trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : String(words[0] || "?").slice(0, 2).toUpperCase();
}

function _statusBadgeHtml(invite) {
  const s = String(invite?.status || "").toLowerCase();
  if (s === "used")    return `<span class="ad-status-badge ad-status--used">Activo</span>`;
  if (s === "pending") return `<span class="ad-status-badge ad-status--pending">Pendiente</span>`;
  if (s === "revoked") return `<span class="ad-status-badge ad-status--revoked">Revocado</span>`;
  return "";
}

function _groupBySubject(item) {
  const map = new Map();
  for (const g of (item.groups || [])) {
    for (const s of (g.subjects || [])) {
      if (!s) continue;
      const list = map.get(s) || [];
      list.push(g.name);
      map.set(s, list);
    }
  }
  return map;
}

export async function renderAdminProfes({ containerEl, sheetEl, backdropEl, fetchJSON, teacherDrawer }) {
  let teachers = [];
  let allGroups = [];
  const expanded = new Set();

  function _teacherRowHtml(item) {
    const key = item.id || item.email;
    const isExpanded = expanded.has(key);
    const bySubject = _groupBySubject(item);
    const expandHtml = isExpanded
      ? (bySubject.size
          ? `<div class="ad-doc-expand">${[...bySubject.entries()].map(([subject, groups]) => `
              <div class="ad-subject-row">
                <span class="ad-subject-name">${_esc(subject)}</span>
                <div class="ad-subject-groups">${groups.map(g => `<span class="ad-chip ad-chip--small">${_esc(g)}</span>`).join("")}</div>
              </div>`).join("")}</div>`
          : `<div class="ad-doc-expand"><p class="ad-empty">Sin asignaciones configuradas</p></div>`)
      : "";

    return `
      <div class="ad-list-row ad-list-row--stack" data-teacher-row="${_esc(key)}">
        <div class="ad-list-row-top">
          <div class="ad-avatar">${_esc(_initials(item.display_name, item.email))}</div>
          <div class="ad-list-row-info">
            <span class="ad-list-row-name">${_esc(item.display_name || "Docente")}</span>
            <span class="ad-list-row-sub">${_esc(item.email || "")}</span>
          </div>
          ${_statusBadgeHtml(item.invite)}
        </div>
        <button type="button" class="ad-link-btn" data-toggle-expand="${_esc(key)}">${isExpanded ? "Ocultar grupos" : "Ver grupos"}</button>
        ${expandHtml}
      </div>`;
  }

  function _draw() {
    containerEl.innerHTML = `
      <div class="ad-tab-header">
        <span class="ad-tab-eyebrow">Curso 2025-26</span>
        <h1 class="ad-tab-title">Profesores</h1>
        <span class="ad-tab-count">Docentes del centro · ${teachers.length}</span>
        <button class="ad-btn ad-btn--primary" type="button" id="adPInviteBtn">+ Invitar</button>
      </div>
      <div id="adPList">
        ${teachers.length ? teachers.map(_teacherRowHtml).join("") : `<p class="ad-empty">No hay docentes creados todavía.</p>`}
      </div>`;

    containerEl.querySelector("#adPInviteBtn").addEventListener("click", () => _openInviteSheet());

    containerEl.querySelectorAll("[data-toggle-expand]").forEach(btn => {
      btn.addEventListener("click", ev => {
        ev.stopPropagation();
        const key = btn.dataset.toggleExpand;
        if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
        _draw();
      });
    });

    containerEl.querySelectorAll("[data-teacher-row]").forEach(row => {
      row.addEventListener("click", ev => {
        if (ev.target.closest("button")) return;
        const key = row.dataset.teacherRow;
        const teacher = teachers.find(t => (t.id || t.email) === key);
        if (teacher?.id) teacherDrawer.open(teacher);
      });
    });
  }

  async function _ensureGroups() {
    if (!allGroups.length) {
      const data = await fetchGroups(fetchJSON).catch(() => ({ items: [] }));
      allGroups = data?.items || [];
    }
    return allGroups;
  }

  async function _openInviteSheet() {
    await _ensureGroups();
    const contentEl = sheetEl.querySelector("#adSheetContent");
    renderTeacherInviteSheet({
      contentEl, fetchJSON, allGroups, existingTeachers: teachers,
      onClose: () => closeSheet(sheetEl, backdropEl),
      onInvited: async () => {
        closeSheet(sheetEl, backdropEl);
        await _reload();
      },
    });
    openSheet(sheetEl, backdropEl);
  }

  async function _reload() {
    const data = await fetchTeachers(fetchJSON).catch(() => ({ items: [] }));
    teachers = data?.items || [];
    _draw();
  }

  containerEl.innerHTML = `<p class="ad-loading">Cargando…</p>`;
  await _reload();
}
