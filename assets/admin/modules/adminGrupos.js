import { escHtml, fetchJSON, toItems, copyToClipboard } from "./adminUtils.js";

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
    const createForm     = document.getElementById("createGroupForm");
    const toggleBtn      = document.getElementById("toggleCreateGroupBtn");
    const isLevel4       = state.gruposLevel === 4;
    const showActions    = state.gruposLevel === 1 || state.gruposLevel === 3;

    if (levelContainer) levelContainer.classList.toggle("hidden", isLevel4);
    if (level4Panel)    level4Panel.classList.toggle("hidden", !isLevel4);
    if (actionsEl)      actionsEl.classList.toggle("hidden", !showActions);

    if (!showActions) {
      createForm?.classList.add("hidden");
      if (toggleBtn) toggleBtn.textContent = "+ Nuevo grupo";
    }

    if      (state.gruposLevel === 1) renderLevel1();
    else if (state.gruposLevel === 2) renderLevel2();
    else if (state.gruposLevel === 3) renderLevel3Loading();
  }

  // ── Level 1 — Etapas + listado compacto (Fix 5) ───────────────────────────

  function compactGroupRow(g) {
    const hint = g.join_code_hint ? `${g.join_code_hint}-????` : "—";
    const countStr = g.student_count != null ? `${g.student_count} alumnos` : "";
    return `<div class="cgRow"
      data-view-students="${g.id}"
      data-group-name="${escHtml(g.name)}"
      data-group-hint="${g.join_code_hint || ""}"
      data-group-stage="${g.stage || ""}"
      data-group-year="${g.year || ""}">
      <span class="cgName">${escHtml(g.name)}</span>
      <span class="cgMeta">${escHtml(stageLabelFor(g.stage || ""))}${g.year ? " · " + g.year + "º" : ""}</span>
      <span class="cgCount">${countStr}</span>
      <span class="cgCode">${escHtml(hint)}</span>
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
      ? `<div class="allGroupsSection">
          <div class="allGroupsHeader">Todos los grupos (${groups.length})</div>
          ${groups.map(compactGroupRow).join("")}
        </div>`
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
    const container = document.getElementById("gruposLevelContainer");
    if (container) container.innerHTML = '<p class="emptyState">Cargando grupos…</p>';
    const ctx = document.getElementById("createGroupContext");
    if (ctx) ctx.textContent = `${stageLabelFor(state.gruposStage)} · ${state.gruposYear}º`;
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
      if (container) container.innerHTML = `<p class="emptyState err">No se pudieron cargar los grupos: ${escHtml(err?.message || "")}</p>`;
    }
  }

  function groupCardHTML(g) {
    const hint       = g.join_code_hint ? `${g.join_code_hint}-????` : "Sin código";
    const trackLabel = g.track ? g.track.toUpperCase() : "";
    return `
      <article class="groupCard">
        <div class="groupCardMain">
          <div class="groupName">${escHtml(g.name)}</div>
          ${trackLabel ? `<div class="groupMeta">Grupo ${escHtml(trackLabel)}</div>` : ""}
        </div>
        <div class="groupCardCode">
          <span class="codeHint" title="Los últimos 4 dígitos solo se muestran al crear o regenerar">${escHtml(hint)}</span>
        </div>
        <div class="groupCardActions">
          <button class="btn primary small" data-view-students="${g.id}" data-group-name="${escHtml(g.name)}" data-group-hint="${g.join_code_hint || ""}">Gestionar grupo</button>
        </div>
      </article>`;
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

  // ── Group CRUD ────────────────────────────────────────────────────────────

  function resetTrackSelect() {
    const sel = document.getElementById("groupTrackSelect");
    if (sel) sel.value = "";
    const custom = document.getElementById("groupTrackCustom");
    if (custom) custom.value = "";
    document.getElementById("groupTrackCustomWrap")?.classList.add("hidden");
  }

  async function createGroup() {
    const errEl   = document.getElementById("createGroupError");
    const showErr = (msg) => { if (errEl) errEl.textContent = msg; };
    if (errEl) errEl.textContent = "";

    if (!state.gruposStage) { showErr("Selecciona una etapa."); return; }
    if (!state.gruposYear)  { showErr("Selecciona un curso."); return; }

    const trackSel = document.getElementById("groupTrackSelect")?.value || "";
    if (!trackSel) { showErr("Selecciona un grupo o vía."); return; }

    let track;
    if (trackSel === "__OTRO__") {
      track = String(document.getElementById("groupTrackCustom")?.value || "").trim();
      if (!track) { showErr("Escribe el nombre de la vía personalizada."); return; }
    } else {
      track = trackSel;
    }

    // Nombre auto-construido: "4º Primaria A", "1º ESO NEAE", etc.
    const name = `${state.gruposYear}º ${stageLabelFor(state.gruposStage)} ${track}`;

    const createBtn = document.getElementById("createGroupBtn");
    if (createBtn) { createBtn.disabled = true; createBtn.textContent = "Creando…"; }

    try {
      await fetchJSON("/api/v1/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stage: state.gruposStage, year: state.gruposYear, track }),
      });
      document.getElementById("createGroupForm")?.classList.add("hidden");
      document.getElementById("createGroupNameRow")?.classList.add("hidden");
      document.getElementById("toggleCreateGroupBtn").textContent = "+ Nuevo grupo";
      if (errEl) errEl.textContent = "";
      resetTrackSelect();
      gruposGoTo(3);
    } catch (err) {
      showErr(err?.message || "No se pudo crear el grupo.");
    } finally {
      if (createBtn) { createBtn.disabled = false; createBtn.textContent = "Crear grupo"; }
    }
  }

  // ── Wire events ───────────────────────────────────────────────────────────

  function wireEvents({ getGroupsModule, onOpenStudentsForGroup }) {
    document.getElementById("gruposBreadcrumb")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-crumb]");
      if (!btn) return;
      gruposGoTo(Number(btn.dataset.crumb));
    });

    document.getElementById("gruposLevelContainer")?.addEventListener("click", (ev) => {
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

    // Fix 2: botón "Nuevo grupo" funciona desde nivel 1 y 3
    document.getElementById("toggleCreateGroupBtn")?.addEventListener("click", () => {
      const form = document.getElementById("createGroupForm");
      const btn  = document.getElementById("toggleCreateGroupBtn");
      const isHidden = form?.classList.contains("hidden");
      form?.classList.toggle("hidden", !isHidden);
      if (btn) btn.textContent = isHidden ? "✕ Cancelar" : "+ Nuevo grupo";

      if (isHidden) {
        // Abrir: configurar form según nivel actual
        const stageRow  = document.getElementById("createGroupStageRow");
        const nameRow   = document.getElementById("createGroupNameRow");
        const ctx       = document.getElementById("createGroupContext");
        const errEl     = document.getElementById("createGroupError");
        if (errEl) errEl.textContent = "";
        document.getElementById("groupName").value  = "";
        document.getElementById("groupTrack").value = "";

        if (state.gruposLevel === 1) {
          // Nivel 1: selección secuencial — etapa → año → vía
          stageRow?.classList.remove("hidden");
          nameRow?.classList.add("hidden");
          if (ctx) ctx.textContent = "";
          const stageSel = document.getElementById("createGroupStageSelect");
          const yearSel  = document.getElementById("createGroupYearSelect");
          if (stageSel) stageSel.value = "";
          if (yearSel)  { yearSel.innerHTML = '<option value="">Curso…</option>'; yearSel.disabled = true; }
          state.gruposStage = null;
          state.gruposYear  = null;
          resetTrackSelect();
          stageSel?.focus();
        } else {
          // Nivel 3: etapa y año ya fijados — ir directo al select de vía
          stageRow?.classList.add("hidden");
          nameRow?.classList.remove("hidden");
          if (ctx) ctx.textContent = `${stageLabelFor(state.gruposStage)} · ${state.gruposYear}º`;
          resetTrackSelect();
          document.getElementById("groupTrackSelect")?.focus();
        }
      }
    });

    // Selects de etapa y curso — flujo secuencial
    document.getElementById("createGroupStageSelect")?.addEventListener("change", () => {
      const stage   = document.getElementById("createGroupStageSelect").value;
      const yearSel = document.getElementById("createGroupYearSelect");
      const nameRow = document.getElementById("createGroupNameRow");
      if (!yearSel) return;
      const years = STAGE_YEARS[stage] || [];
      yearSel.innerHTML = '<option value="">Curso…</option>' + years.map((y) => `<option value="${y}">${y}º</option>`).join("");
      yearSel.disabled = !stage;
      state.gruposStage = stage || null;
      state.gruposYear  = null;
      // Cambiar etapa oculta de nuevo el nombre hasta que se elija año
      nameRow?.classList.add("hidden");
      if (stage) yearSel.focus();
    });

    document.getElementById("createGroupYearSelect")?.addEventListener("change", () => {
      const year    = Number(document.getElementById("createGroupYearSelect").value) || null;
      const nameRow = document.getElementById("createGroupNameRow");
      state.gruposYear = year;
      if (year) {
        resetTrackSelect();
        nameRow?.classList.remove("hidden");
        document.getElementById("groupTrackSelect")?.focus();
      } else {
        nameRow?.classList.add("hidden");
      }
    });

    document.getElementById("groupTrackSelect")?.addEventListener("change", () => {
      const val       = document.getElementById("groupTrackSelect").value;
      const customWrap = document.getElementById("groupTrackCustomWrap");
      if (val === "__OTRO__") {
        customWrap?.classList.remove("hidden");
        document.getElementById("groupTrackCustom")?.focus();
      } else {
        customWrap?.classList.add("hidden");
        const custom = document.getElementById("groupTrackCustom");
        if (custom) custom.value = "";
      }
    });

    document.getElementById("cancelCreateGroupBtn")?.addEventListener("click", () => {
      document.getElementById("createGroupForm")?.classList.add("hidden");
      document.getElementById("createGroupNameRow")?.classList.add("hidden");
      document.getElementById("toggleCreateGroupBtn").textContent = "+ Nuevo grupo";
      document.getElementById("createGroupError").textContent = "";
      resetTrackSelect();
    });

    document.getElementById("createGroupBtn")?.addEventListener("click", () => {
      createGroup().catch((err) => {
        const errEl = document.getElementById("createGroupError");
        if (errEl) errEl.textContent = err?.message || "No se pudo crear el grupo.";
      });
    });

    document.getElementById("groupTrackCustom")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") createGroup().catch(() => {});
    });

  }

  return { loadAdminGroups, renderGrupos, gruposGoTo, wireEvents };
}
