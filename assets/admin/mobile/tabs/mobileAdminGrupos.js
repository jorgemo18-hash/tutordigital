// mobileAdminGrupos.js — Tab Grupos: etapa summary cards (informational,
// not filters — matches the reference design) + full group list + "+ Nuevo"
// sheet + group detail (drill-in overlay, not a tab switch).

import { fetchGroups, fetchTeachers } from "../mobileAdminData.js";
import { openSheet, closeSheet } from "../mobileAdminSheets.js";
import { renderGroupCreateSheet } from "../groups/mobileGroupCreateSheet.js";
import { renderGroupDetail } from "../groups/mobileGroupDetail.js";
import { icon } from "../mobileAdminIcons.js";
import { pushBackGuard, popBackGuard } from "../../../shared/js/mobileBackGuard.js";

const STAGE_LABEL  = { primaria: "Primaria", eso: "ESO", bachiller: "Bachillerato" };
const STAGE_LETTER = { primaria: "P", eso: "E", bachiller: "B" };
const STAGE_ORDER  = ["primaria", "eso", "bachiller"];

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _stageCards(groups) {
  const byStage = {};
  for (const g of groups) {
    if (!g.stage) continue;
    (byStage[g.stage] = byStage[g.stage] || []).push(g);
  }
  return STAGE_ORDER.filter(s => byStage[s]?.length).map(s => ({ stage: s, count: byStage[s].length }));
}

function _groupRowHtml(g) {
  const letter = STAGE_LETTER[g.stage] || (g.name || "?")[0].toUpperCase();
  const sub = [STAGE_LABEL[g.stage] || g.stage, g.year ? `${g.year}º` : ""].filter(Boolean).join(" · ");
  const n = g.student_count ?? 0;
  const countCls = n === 0 ? "empty" : "one";
  const countTxt = n === 1 ? "<strong>1</strong> alumno" : `${n} alumnos`;
  return `
    <button type="button" class="grow" data-group-id="${_esc(g.id)}">
      <span class="grow-letter">${_esc(letter)}</span>
      <span class="grow-main">
        <span class="grow-name">${_esc(g.name)}</span>
        <span class="grow-sub">${_esc(sub)}</span>
      </span>
      <span class="grow-count ${countCls}">${countTxt}</span>
    </button>`;
}

export async function renderAdminGrupos({ containerEl, drillHost, sheetEl, backdropEl, fetchJSON }) {
  let groups   = [];
  let teachers = [];

  function _draw() {
    const stageCards = _stageCards(groups);
    const stageCount = stageCards.length;

    containerEl.innerHTML = `
      <div class="phead">
        <div class="phead-row">
          <div>
            <div class="phead-eyebrow">Centro · Director</div>
            <h1 class="phead-title"><em>Grupos</em></h1>
          </div>
          <button type="button" class="phead-pill" id="adGNewBtn">${icon("plus", { size: 15, sw: 2.4 })} Nuevo</button>
        </div>
        <div class="phead-meta"><span>${groups.length} grupo${groups.length !== 1 ? "s" : ""}</span><span class="sep"></span><span>${stageCount} etapa${stageCount !== 1 ? "s" : ""}</span></div>
      </div>

      <div class="stagerow">
        ${stageCards.map(s => `
          <div class="stagecard">
            <span class="stagecard-tag">Etapa</span>
            <div class="stagecard-name">${_esc(STAGE_LABEL[s.stage])}</div>
            <div class="stagecard-foot">
              <span class="stagecard-num">${s.count}</span>
              <span class="stagecard-lbl">grupos</span>
            </div>
          </div>`).join("")}
      </div>

      <div class="seclabel">
        <span class="seclabel-name">Todos los grupos</span>
        <span class="seclabel-count">${groups.length}</span>
        <span class="seclabel-line"></span>
      </div>
      <div class="grouplist">
        ${groups.length ? groups.map(_groupRowHtml).join("") : `<p class="dcard-empty">No hay grupos creados todavía.</p>`}
      </div>`;

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

  function _closeDetail() {
    drillHost.innerHTML = "";
    popBackGuard();
  }

  async function _openDetail(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    await _ensureTeachers();
    await renderGroupDetail({
      hostEl: drillHost, fetchJSON, group, teachers,
      onBack: _closeDetail,
      onDeleted: (id) => { groups = groups.filter(g => g.id !== id); _closeDetail(); _draw(); },
    });
    pushBackGuard(() => { drillHost.innerHTML = ""; });
  }

  function _openCreateSheet() {
    const contentEl = sheetEl.querySelector("#adSheetContent");
    renderGroupCreateSheet({
      contentEl, fetchJSON,
      onClose: () => closeSheet(sheetEl, backdropEl),
      onCreated: (created) => {
        groups = [...groups, ...created.filter(Boolean)];
        closeSheet(sheetEl, backdropEl);
        _draw();
      },
    });
    openSheet(sheetEl, backdropEl);
  }

  containerEl.innerHTML = `<p class="dcard-empty">Cargando…</p>`;
  const data = await fetchGroups(fetchJSON).catch(() => ({ items: [] }));
  groups = data?.items || [];
  _draw();
}
