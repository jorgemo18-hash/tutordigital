import { escHtml, fetchJSON, toItems } from "./adminUtils.js";
import { initCreateGroupForm } from "./adminCreateGroupForm.js";

// ── Constants ──────────────────────────────────────────────────────────────

const STAGES = [
  { key: "primaria",  label: "Primaria",    years: [1, 2, 3, 4, 5, 6] },
  { key: "eso",       label: "ESO",         years: [1, 2, 3, 4] },
  { key: "bachiller", label: "Bachillerato",years: [1, 2] },
];
const STAGE_YEARS = { primaria: [1,2,3,4,5,6], eso: [1,2,3,4], bachiller: [1,2] };
const SPECIAL_KEYWORDS = /apoyo|neae|refuerzo|especial|pmar|desdoble|adaptad/i;

export function initGruposSection({ state, onGroupsLoaded }) {

  function stageLabelFor(key) {
    return STAGES.find((s) => s.key === key)?.label || String(key || "");
  }
  function yearLabel(stage, year) { return `${year}º ${stageLabelFor(stage)}`; }
  function isSpecialGroup(g) { return SPECIAL_KEYWORDS.test(g.name) || SPECIAL_KEYWORDS.test(g.track || ""); }

  // ── Navigation ────────────────────────────────────────────────────────────

  function gruposGoTo(level, stage = null, year = null) {
    state.gruposLevel = level;
    if (level === 1) {
      // Reset completo al volver al nivel raíz
      state.gruposStage            = null;
      state.gruposYear             = null;
      state.activeGroupForStudents = null;
    } else {
      if (stage !== null) state.gruposStage = stage;
      if (year  !== null) state.gruposYear  = year;
    }
    renderGrupos();
  }

  function renderGruposBreadcrumb() {
    const nav = document.getElementById("gruposBreadcrumb");
    if (!nav) return;
    if (state.gruposLevel === 1) { nav.classList.add("hidden"); nav.innerHTML = ""; return; }
    nav.classList.remove("hidden");
    const slabel = stageLabelFor(state.gruposStage);
    const ylabel = state.gruposYear ? yearLabel(state.gruposStage, state.gruposYear) : "";
    let html = `<button class="crumbBtn" data-crumb="1">Grupos</button><span class="crumbSep">›</span>`;
    if (state.gruposLevel === 2) {
      html += `<span class="crumbCurrent">${slabel}</span>`;
    } else if (state.gruposLevel === 3) {
      html += `<button class="crumbBtn" data-crumb="2">${slabel}</button><span class="crumbSep">›</span><span class="crumbCurrent">${ylabel}</span>`;
    } else if (state.gruposLevel === 4) {
      html += `<button class="crumbBtn" data-crumb="2">${slabel}</button><span class="crumbSep">›</span>`;
      html += `<button class="crumbBtn" data-crumb="3">${ylabel}</button><span class="crumbSep">›</span>`;
      html += `<span class="crumbCurrent">${escHtml(state.activeGroupForStudents?.name || "")}</span>`;
    }
    nav.innerHTML = html;
  }

  function renderGrupos() {
    renderGruposBreadcrumb();
    const level4Panel    = document.getElementById("gruposLevel4Panel");
    const levelContainer = document.getElementById("gruposLevelContainer");
    const actionsEl      = document.getElementById("gruposActions");
    const toggleBtn      = document.getElementById("toggleCreateGroupBtn");
    const isLevel4       = state.gruposLevel === 4;
    const showActions    = state.gruposLevel === 1;

    if (levelContainer) levelContainer.classList.toggle("hidden", isLevel4);
    if (level4Panel)    level4Panel.classList.toggle("hidden", !isLevel4);
    if (actionsEl)      actionsEl.classList.toggle("hidden", !showActions);
    document.getElementById("gruposBackBtn")?.classList.toggle("hidden", state.gruposLevel === 1);

    if (!showActions) {
      document.getElementById("createGroupModal")?.classList.add("hidden");
      if (toggleBtn) toggleBtn.textContent = "+ Nuevo grupo";
    }

    if      (state.gruposLevel === 1) renderLevel1();
    else if (state.gruposLevel === 2) renderLevel2();
    else if (state.gruposLevel === 3) renderLevel3Loading();
  }

  // ── Level 1 — Etapas + listado compacto (Fix 5) ───────────────────────────

  function compactGroupRow(g) {
    const stageLabel = stageLabelFor(g.stage || "");
    const letter     = stageLabel.charAt(0).toUpperCase() || "G";
    const sub        = stageLabel + (g.year ? " · " + g.year + "º" : "");
    const countHTML  = g.student_count != null
      ? `<span class="av-count"><strong>${g.student_count}</strong> alumnos</span>`
      : "";
    return `<div class="av-group-row"
      data-view-students="${g.id}"
      data-group-name="${escHtml(g.name)}"
      data-group-stage="${g.stage || ""}"
      data-group-year="${g.year || ""}"
      style="cursor:pointer">
      <div class="av-letter">${escHtml(letter)}</div>
      <div>
        <div class="av-cell-name">${escHtml(g.name)}</div>
        <div class="av-cell-sub">${escHtml(sub)}</div>
      </div>
      ${countHTML}
    </div>`;
  }

  function renderLevel1() {
    const container = document.getElementById("gruposLevelContainer");
    if (!container) return;
    const groups = state.adminGroups || [];
    const countByStage = {};
    for (const g of groups) { const k = g.stage || "__none__"; countByStage[k] = (countByStage[k] || 0) + 1; }

    const stageGrid = `<div class="stageGrid">${
      STAGES.map((s) => {
        const n = countByStage[s.key] || 0;
        return `<button class="stageCard" data-goto-stage="${s.key}">
          <span class="stageCardName">${s.label}</span>
          <span class="stageCardCount">${n} grupo${n !== 1 ? "s" : ""}</span>
        </button>`;
      }).join("")
    }</div>`;

    const allGroupsList = groups.length
      ? `<details class="allGroupsSection" open>
          <summary class="allGroupsHeader">Todos los grupos (${groups.length})</summary>
          <div class="allGroupsBody">${groups.map(compactGroupRow).join("")}</div>
        </details>`
      : "";

    container.innerHTML = stageGrid + allGroupsList;
  }

  // ── Level 2 — Cursos ──────────────────────────────────────────────────────

  function renderLevel2() {
    const container = document.getElementById("gruposLevelContainer");
    if (!container) return;
    const stageDef = STAGES.find((s) => s.key === state.gruposStage);
    if (!stageDef) return;
    const stageGroups = (state.adminGroups || []).filter((g) => g.stage === state.gruposStage);
    const countByYear = {};
    for (const g of stageGroups) { const y = g.year || 0; countByYear[y] = (countByYear[y] || 0) + 1; }
    container.innerHTML = `<div class="yearGrid">${
      stageDef.years.map((y) => {
        const n = countByYear[y] || 0;
        return `<button class="yearCard" data-goto-year="${y}">
          <span class="yearCardNum">${y}º</span>
          <span class="yearCardLabel">${stageDef.label}</span>
          <span class="yearCardCount">${n} grupo${n !== 1 ? "s" : ""}</span>
        </button>`;
      }).join("")
    }</div>`;
  }

  // ── Level 3 — Grupos ──────────────────────────────────────────────────────

  function renderLevel3Loading() {
    // Defensa extra: ocultar el botón "+ Nuevo grupo" aunque renderGrupos ya lo haya hecho
    document.getElementById("gruposActions")?.classList.add("hidden");
    const container = document.getElementById("gruposLevelContainer");
    if (container) container.innerHTML = '<p class="emptyState">Cargando grupos…</p>';
    loadGroupsForLevel3().catch(console.error);
  }

  async function loadGroupsForLevel3() {
    const { gruposStage: stage, gruposYear: year } = state;
    const container = document.getElementById("gruposLevelContainer");
    try {
      const params = new URLSearchParams({ stage, year: String(year) });
      const data   = await fetchJSON(`/api/v1/admin/groups?${params}`);
      const loaded = toItems(data, "items");
      const byId   = new Map((state.adminGroups || []).map((g) => [g.id, g]));
      for (const g of loaded) byId.set(g.id, g);
      state.adminGroups = [...byId.values()];
      renderGroupsLevel3List(loaded);
    } catch (err) {
      if (!container) return;
      if (err.status === 401 || err.status === 403) {
        container.innerHTML = `<p class="emptyState err">Sesión expirada. <a href="/index.html">Volver al inicio de sesión</a>.</p>`;
        return;
      }
      const isNetwork = !err.status;
      container.innerHTML = `
        <p class="emptyState err">No se pudieron cargar los grupos: ${escHtml(err?.message || "Error desconocido")}</p>
        ${isNetwork ? `<button class="btn ghost small" data-retry-groups>Reintentar</button>` : ""}`.trim();
    } finally {
      document.getElementById("gruposBackBtn")?.classList.toggle("hidden", state.gruposLevel === 1);
    }
  }

  function groupCardHTML(g) {
    const track  = g.track ? g.track.toUpperCase() : "";
    const letter = track
      ? track.charAt(0)
      : stageLabelFor(g.stage || "").charAt(0).toUpperCase() || "G";
    const sub = track
      ? `Grupo ${escHtml(track)}`
      : escHtml(stageLabelFor(g.stage || ""));
    return `
      <div class="av-group-row">
        <div class="av-letter">${escHtml(letter)}</div>
        <div>
          <div class="av-cell-name">${escHtml(g.name)}</div>
          <div class="av-cell-sub">${sub}</div>
        </div>
        <button class="btn primary small" data-view-students="${g.id}" data-group-name="${escHtml(g.name)}">Gestionar</button>
      </div>`;
  }

  function renderGroupsLevel3List(groups) {
    const container = document.getElementById("gruposLevelContainer");
    if (!container) return;
    if (!groups.length) { container.innerHTML = '<p class="emptyState">No hay grupos en este curso. Crea el primero con el botón de arriba.</p>'; return; }
    const main    = groups.filter((g) => !isSpecialGroup(g));
    const special = groups.filter((g) =>  isSpecialGroup(g));
    let html = main.length
      ? `<div class="groupsList">${main.map(groupCardHTML).join("")}</div>`
      : '<p class="emptyState">No hay grupos ordinarios en este curso.</p>';
    if (special.length) {
      html += `<details class="specialGroupsBlock">
        <summary class="specialGroupsSummary">Grupos de apoyo y refuerzo <span class="specialGroupsCount">${special.length}</span></summary>
        <div class="groupsList specialGroupsList">${special.map(groupCardHTML).join("")}</div>
      </details>`;
    }
    container.innerHTML = html;
  }

  // ── Full load ─────────────────────────────────────────────────────────────

  async function loadAdminGroups() {
    try {
      const data = await fetchJSON("/api/v1/admin/groups");
      state.adminGroups       = toItems(data, "items");
      state.adminGroupsLoaded = true;
      renderGrupos();
      onGroupsLoaded?.();
    } catch (err) {
      const container = document.getElementById("gruposLevelContainer");
      if (container) container.innerHTML = `<p class="emptyState err">No se pudieron cargar los grupos: ${escHtml(err?.message || "")}</p>`;
    }
  }

  // ── Wire events ───────────────────────────────────────────────────────────

  function wireEvents({ onOpenStudentsForGroup }) {
    document.getElementById("gruposBackBtn")?.addEventListener("click", () => {
      if (state.gruposLevel === 4) { state.activeGroupForStudents = null; gruposGoTo(3); }
      else if (state.gruposLevel === 3) gruposGoTo(2);
      else if (state.gruposLevel === 2) gruposGoTo(1);
    });

    document.getElementById("gruposBreadcrumb")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-crumb]");
      if (!btn) return;
      gruposGoTo(Number(btn.dataset.crumb));
    });

    document.getElementById("gruposLevelContainer")?.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-retry-groups]")) { renderLevel3Loading(); return; }
      const stageBtn = ev.target.closest("[data-goto-stage]");
      if (stageBtn) { gruposGoTo(2, stageBtn.dataset.gotoStage); return; }
      const yearBtn = ev.target.closest("[data-goto-year]");
      if (yearBtn) { gruposGoTo(3, null, Number(yearBtn.dataset.gotoYear)); return; }
      const viewBtn = ev.target.closest("[data-view-students]");
      if (viewBtn) {
        // Si venimos del listado compacto (nivel 1), fijar stage/year para el breadcrumb
        const gs = viewBtn.dataset.groupStage || null;
        const gy = Number(viewBtn.dataset.groupYear) || null;
        if (gs) state.gruposStage = gs;
        if (gy) state.gruposYear  = gy;
        onOpenStudentsForGroup(viewBtn.dataset.viewStudents, viewBtn.dataset.groupName || "Grupo", viewBtn.dataset.groupHint || "");
      }
    });

    function closeModal() {
      document.getElementById("createGroupModal")?.classList.add("hidden");
    }

    const formModule = initCreateGroupForm({
      onGroupCreated(results, stage, year) {
        for (const r of results) {
          if (r?.group) state.adminGroups = [...(state.adminGroups || []), r.group];
        }
        closeModal();
        formModule.resetForm();
        state.gruposStage = stage;
        state.gruposYear  = year;
        gruposGoTo(3, stage, year);
      },
      onCancel: closeModal,
    });

    document.getElementById("toggleCreateGroupBtn")?.addEventListener("click", () => {
      document.getElementById("createGroupModal")?.classList.remove("hidden");
      formModule.resetForm();
    });

    document.getElementById("closeCreateGroupBtn")?.addEventListener("click", closeModal);

    document.getElementById("createGroupModal")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });

  }

  return { loadAdminGroups, renderGrupos, gruposGoTo, wireEvents };
}
