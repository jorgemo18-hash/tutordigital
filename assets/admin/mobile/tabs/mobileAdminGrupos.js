// mobileAdminGrupos.js — Tab Grupos: flat filterable list (by etapa) +
// "+ Nuevo" create sheet + group detail (in-place navigation, not a sheet).

import { fetchGroups, fetchTeachers } from "../mobileAdminData.js";
import { openSheet, closeSheet } from "../mobileAdminSheets.js";
import { renderGroupCreateSheet } from "../groups/mobileGroupCreateSheet.js";
import { renderGroupDetail } from "../groups/mobileGroupDetail.js";

const STAGE_LABEL = { primaria: "Primaria", eso: "ESO", bachiller: "Bachillerato" };
const STAGE_LETTER = { primaria: "P", eso: "E", bachiller: "B" };

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _groupRowHtml(g) {
  const letter = STAGE_LETTER[g.stage] || (g.name || "?")[0].toUpperCase();
  const sub = [STAGE_LABEL[g.stage] || g.stage, g.year ? `${g.year}º` : ""].filter(Boolean).join(" · ");
  const n = g.student_count ?? 0;
  return `
    <button type="button" class="ad-list-row" data-group-id="${_esc(g.id)}">
      <div class="ad-letter ad-letter--${_esc(g.stage || "")}">${_esc(letter)}</div>
      <div class="ad-list-row-info">
        <span class="ad-list-row-name">${_esc(g.name)}</span>
        <span class="ad-list-row-sub">${_esc(sub)}</span>
      </div>
      <span class="ad-count-badge${n > 0 ? " ad-count-badge--active" : ""}">${n}</span>
    </button>`;
}

export async function renderAdminGrupos({ containerEl, sheetEl, backdropEl, fetchJSON }) {
  let groups   = [];
  let teachers = [];
  let activeFilter = "todos";

  function _filteredGroups() {
    return activeFilter === "todos" ? groups : groups.filter(g => g.stage === activeFilter);
  }

  function _drawList() {
    const stages = new Set(groups.map(g => g.stage).filter(Boolean));
    const filterChips = ["todos", ...["primaria", "eso", "bachiller"].filter(s => stages.has(s))];
    const visible = _filteredGroups();

    containerEl.innerHTML = `
      <div class="ad-tab-header">
        <span class="ad-tab-eyebrow">Centro · Director</span>
        <h1 class="ad-tab-title">Grupos</h1>
        <span class="ad-tab-count">${groups.length} grupo${groups.length !== 1 ? "s" : ""} · ${stages.size} etapa${stages.size !== 1 ? "s" : ""}</span>
        <button class="ad-btn ad-btn--primary" type="button" id="adGNewBtn">+ Nuevo</button>
      </div>
      <div class="ad-chip-row ad-chip-row--scroll">
        ${filterChips.map(s => `<button type="button" class="ad-chip${activeFilter === s ? " ad-chip--active" : ""}" data-filter="${s}">${s === "todos" ? "Todos" : STAGE_LABEL[s]}</button>`).join("")}
      </div>
      <div id="adGList">
        ${visible.length ? visible.map(_groupRowHtml).join("") : `<p class="ad-empty">No hay grupos en esta etapa.</p>`}
      </div>`;

    containerEl.querySelectorAll("[data-filter]").forEach(btn => btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      _drawList();
    }));
    containerEl.querySelectorAll("[data-group-id]").forEach(btn => btn.addEventListener("click", () => _openDetail(btn.dataset.groupId)));
    containerEl.querySelector("#adGNewBtn").addEventListener("click", () => _openCreateSheet());
  }

  async function _ensureTeachers() {
    if (!teachers.length) {
      const data = await fetchTeachers(fetchJSON).catch(() => ({ items: [] }));
      teachers = data?.items || [];
    }
    return teachers;
  }

  async function _openDetail(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    await _ensureTeachers();
    await renderGroupDetail({
      containerEl, fetchJSON, group, teachers,
      onBack: _drawList,
      onDeleted: (id) => { groups = groups.filter(g => g.id !== id); _drawList(); },
    });
  }

  function _openCreateSheet() {
    const contentEl = sheetEl.querySelector("#adSheetContent");
    renderGroupCreateSheet({
      contentEl, fetchJSON,
      onClose: () => closeSheet(sheetEl, backdropEl),
      onCreated: (created) => {
        groups = [...groups, ...created.filter(Boolean)];
        closeSheet(sheetEl, backdropEl);
        _drawList();
      },
    });
    openSheet(sheetEl, backdropEl);
  }

  containerEl.innerHTML = `<p class="ad-loading">Cargando…</p>`;
  const data = await fetchGroups(fetchJSON).catch(() => ({ items: [] }));
  groups = data?.items || [];
  _drawList();
}
