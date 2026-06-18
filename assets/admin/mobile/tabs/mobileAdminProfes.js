// mobileAdminProfes.js — Tab Profes.: teacher list (expandable subjects per
// group), "+ Invitar" sheet, and tap-to-edit via the existing desktop
// teacherDrawer singleton (ctx.teacherDrawer — same overlay, same endpoint).
// Structure/classes match the reference design's AdminProfesores exactly.

import { fetchTeachers, fetchGroups } from "../mobileAdminData.js";
import { openSheet, closeSheet } from "../mobileAdminSheets.js";
import { renderTeacherInviteSheet } from "../teachers/mobileTeacherInviteSheet.js";
import { icon } from "../mobileAdminIcons.js";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _initials(name, email) {
  const words = String(name || email || "?").trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : String(words[0] || "?").slice(0, 2).toUpperCase();
}

function _statusHtml(invite) {
  const s = String(invite?.status || "used").toLowerCase();
  if (s === "pending") return `<span class="status-pend"><span class="dot"></span>pendiente</span>`;
  if (s === "revoked") return `<span class="status-pend"><span class="dot"></span>revocado</span>`;
  return `<span class="status-ok"><span class="dot"></span>activo</span>`;
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

  function _teacherBlockHtml(item) {
    const key = item.id || item.email;
    const isOpen = expanded.has(key);
    const bySubject = _groupBySubject(item);

    return `
      <div class="gblock">
        <div class="doc-expand-head" data-toggle="${_esc(key)}">
          <div class="pav lg">${_esc(_initials(item.display_name, item.email))}</div>
          <div class="pinfo">
            <span class="pname">${_esc(item.display_name || "Docente")}</span>
            <span class="pmail">${_esc(item.email || "")}</span>
          </div>
          ${_statusHtml(item.invite)}
        </div>
        ${isOpen ? `
        <div class="doc-assign">
          ${bySubject.size ? [...bySubject.entries()].map(([subject, groups]) => `
            <div class="doc-assign-row">
              <span class="doc-assign-subj">${_esc(subject)}</span>
              <div class="doc-chips">${groups.map(g => `<span class="schip plain">${_esc(g)}</span>`).join("")}</div>
            </div>`).join("") : `<div class="dcard-empty">Sin asignaciones configuradas.</div>`}
        </div>` : ""}
        <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:16px">
          ${item.id ? `<button type="button" class="doc-ver" data-edit="${_esc(item.id)}">Editar</button>` : ""}
          <button type="button" class="doc-ver" data-toggle="${_esc(key)}">${isOpen ? "Ocultar grupos" : "Ver grupos"} ${icon("chevD", { size: 13 })}</button>
        </div>
      </div>`;
  }

  function _draw() {
    containerEl.innerHTML = `
      <div class="phead">
        <div class="phead-row">
          <div>
            <div class="phead-eyebrow">Curso 2025–26</div>
            <h1 class="phead-title"><em>Profesores</em></h1>
          </div>
          <button type="button" class="phead-pill" id="adPInviteBtn">${icon("plus", { size: 15, sw: 2.4 })} Invitar</button>
        </div>
        <div class="phead-meta"><span>Docentes del centro · ${teachers.length}</span></div>
      </div>
      <div class="grouplist">
        ${teachers.length ? teachers.map(_teacherBlockHtml).join("") : `<p class="dcard-empty">No hay docentes creados todavía.</p>`}
      </div>`;

    containerEl.querySelector("#adPInviteBtn").addEventListener("click", () => _openInviteSheet());

    containerEl.querySelectorAll("[data-toggle]").forEach(el => {
      el.addEventListener("click", () => {
        const key = el.dataset.toggle;
        if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
        _draw();
      });
    });

    containerEl.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", ev => {
        ev.stopPropagation();
        const teacher = teachers.find(t => t.id === btn.dataset.edit);
        if (teacher) teacherDrawer.open(teacher);
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

  containerEl.innerHTML = `<p class="dcard-empty">Cargando…</p>`;
  await _reload();
}
