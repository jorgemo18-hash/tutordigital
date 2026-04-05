import { escHtml, fetchJSON, toItems, copyToClipboard } from "./adminUtils.js";

// ── Constants ──────────────────────────────────────────────────────────────

const STAGES = [
  { key: "primaria",  label: "Primaria",    years: [1, 2, 3, 4, 5, 6] },
  { key: "eso",       label: "ESO",         years: [1, 2, 3, 4] },
  { key: "bachiller", label: "Bachillerato",years: [1, 2] },
];

const SPECIAL_KEYWORDS = /apoyo|neae|refuerzo|especial|pmar|desdoble|adaptad/i;

// ── Init ───────────────────────────────────────────────────────────────────

export function initGruposSection({ state, onGroupsLoaded }) {
  // ── Label helpers ─────────────────────────────────────────────────────────

  function stageLabelFor(key) {
    return STAGES.find((s) => s.key === key)?.label || String(key || "");
  }

  function yearLabel(stage, year) {
    return `${year}º ${stageLabelFor(stage)}`;
  }

  function isSpecialGroup(g) {
    return SPECIAL_KEYWORDS.test(g.name) || SPECIAL_KEYWORDS.test(g.track || "");
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function gruposGoTo(level, stage = null, year = null) {
    state.gruposLevel = level;
    if (stage !== null) state.gruposStage = stage;
    if (year  !== null) state.gruposYear  = year;
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
    const level4Panel     = document.getElementById("gruposLevel4Panel");
    const levelContainer  = document.getElementById("gruposLevelContainer");
    const actionsEl       = document.getElementById("gruposActions");
    const createForm      = document.getElementById("createGroupForm");
    const toggleBtn       = document.getElementById("toggleCreateGroupBtn");
    const isLevel4        = state.gruposLevel === 4;

    if (levelContainer) levelContainer.classList.toggle("hidden", isLevel4);
    if (level4Panel)    level4Panel.classList.toggle("hidden", !isLevel4);
    if (actionsEl)      actionsEl.classList.toggle("hidden", state.gruposLevel !== 3);

    if (state.gruposLevel !== 3) {
      createForm?.classList.add("hidden");
      if (toggleBtn) toggleBtn.textContent = "+ Nuevo grupo";
    }

    if      (state.gruposLevel === 1) renderLevel1();
    else if (state.gruposLevel === 2) renderLevel2();
    else if (state.gruposLevel === 3) renderLevel3Loading();
    // level 4: content rendered by openStudentsForGroup (in adminAlumnos)
  }

  // ── Level 1 — Etapas ──────────────────────────────────────────────────────

  function renderLevel1() {
    const container = document.getElementById("gruposLevelContainer");
    if (!container) return;
    const countByStage = {};
    for (const g of state.adminGroups || []) {
      const k = g.stage || "__none__";
      countByStage[k] = (countByStage[k] || 0) + 1;
    }
    container.innerHTML = `<div class="stageGrid">${
      STAGES.map((s) => {
        const n = countByStage[s.key] || 0;
        return `<button class="stageCard" data-goto-stage="${s.key}">
          <span class="stageCardName">${s.label}</span>
          <span class="stageCardCount">${n} grupo${n !== 1 ? "s" : ""}</span>
        </button>`;
      }).join("")
    }</div>`;
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
      const byId   = new Map(state.adminGroups.map((g) => [g.id, g]));
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
          <button class="btn ghost small" data-regen-id="${g.id}">↺ Nuevo código</button>
        </div>
        <div class="groupCardActions">
          <button class="btn primary small" data-view-students="${g.id}" data-group-name="${escHtml(g.name)}">Gestionar grupo</button>
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
      state.adminGroups      = toItems(data, "items");
      state.adminGroupsLoaded = true;
      renderGrupos();
      onGroupsLoaded?.();
    } catch (err) {
      const container = document.getElementById("gruposLevelContainer");
      if (container) container.innerHTML = `<p class="emptyState err">No se pudieron cargar los grupos: ${escHtml(err?.message || "")}</p>`;
    }
  }

  // ── Code result ───────────────────────────────────────────────────────────

  function showCodeResult(code) {
    const box     = document.getElementById("codeResultBox");
    const display = document.getElementById("codeDisplay");
    if (!box || !display) return;
    display.textContent = code;
    box.classList.remove("hidden");
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ── Group CRUD ────────────────────────────────────────────────────────────

  async function createGroup(groupsModuleRef) {
    const name    = String(document.getElementById("groupName")?.value || "").trim();
    const track   = String(document.getElementById("groupTrack")?.value || "").trim();
    const errEl   = document.getElementById("createGroupError");
    const showErr = (msg) => { if (errEl) errEl.textContent = msg; };
    if (errEl) errEl.textContent = "";
    if (!name) { showErr("El nombre del grupo es obligatorio."); return; }

    const body = { name, stage: state.gruposStage, year: state.gruposYear };
    if (track) body.track = track;

    const createBtn = document.getElementById("createGroupBtn");
    if (createBtn) { createBtn.disabled = true; createBtn.textContent = "Creando…"; }

    try {
      const data = await fetchJSON("/api/v1/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      document.getElementById("createGroupForm")?.classList.add("hidden");
      document.getElementById("toggleCreateGroupBtn").textContent = "+ Nuevo grupo";
      document.getElementById("groupName").value  = "";
      document.getElementById("groupTrack").value = "";
      if (errEl) errEl.textContent = "";
      if (data.join_code) showCodeResult(data.join_code);
      await loadGroupsForLevel3();
      await groupsModuleRef?.loadGroups();
    } catch (err) {
      showErr(err?.message || "No se pudo crear el grupo.");
    } finally {
      if (createBtn) { createBtn.disabled = false; createBtn.textContent = "Crear grupo"; }
    }
  }

  async function regenerateCode(groupId) {
    try {
      const data = await fetchJSON(`/api/v1/admin/groups/${groupId}/regenerate-code`, { method: "POST" });
      if (data.join_code) showCodeResult(data.join_code);
      await loadGroupsForLevel3();
    } catch (err) {
      const container = document.getElementById("gruposLevelContainer");
      const errDiv = document.createElement("p");
      errDiv.className = "emptyState err";
      errDiv.textContent = err?.message || "No se pudo regenerar el código.";
      container?.prepend(errDiv);
      setTimeout(() => errDiv.remove(), 5000);
    }
  }

  // ── Wire events ───────────────────────────────────────────────────────────

  function wireEvents({ getGroupsModule, onOpenStudentsForGroup }) {
    document.getElementById("gruposBreadcrumb")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-crumb]");
      if (!btn) return;
      const level = Number(btn.dataset.crumb);
      gruposGoTo(level);
    });

    document.getElementById("gruposLevelContainer")?.addEventListener("click", (ev) => {
      const stageBtn = ev.target.closest("[data-goto-stage]");
      if (stageBtn) { gruposGoTo(2, stageBtn.dataset.gotoStage); return; }
      const yearBtn = ev.target.closest("[data-goto-year]");
      if (yearBtn) { gruposGoTo(3, null, Number(yearBtn.dataset.gotoYear)); return; }
      const regenBtn = ev.target.closest("[data-regen-id]");
      if (regenBtn) { regenerateCode(regenBtn.dataset.regenId).catch(console.error); return; }
      const viewBtn = ev.target.closest("[data-view-students]");
      if (viewBtn) onOpenStudentsForGroup(viewBtn.dataset.viewStudents, viewBtn.dataset.groupName || "Grupo");
    });

    document.getElementById("toggleCreateGroupBtn")?.addEventListener("click", () => {
      const form = document.getElementById("createGroupForm");
      const btn  = document.getElementById("toggleCreateGroupBtn");
      const isHidden = form?.classList.contains("hidden");
      form?.classList.toggle("hidden", !isHidden);
      if (btn) btn.textContent = isHidden ? "✕ Cancelar" : "+ Nuevo grupo";
      if (isHidden) document.getElementById("groupName")?.focus();
    });

    document.getElementById("cancelCreateGroupBtn")?.addEventListener("click", () => {
      document.getElementById("createGroupForm")?.classList.add("hidden");
      document.getElementById("toggleCreateGroupBtn").textContent = "+ Nuevo grupo";
      document.getElementById("createGroupError").textContent = "";
    });

    document.getElementById("createGroupBtn")?.addEventListener("click", () => {
      createGroup(getGroupsModule()).catch((err) => {
        const errEl = document.getElementById("createGroupError");
        if (errEl) errEl.textContent = err?.message || "No se pudo crear el grupo.";
      });
    });

    document.getElementById("groupName")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") createGroup(getGroupsModule()).catch(() => {});
    });

    document.getElementById("closeCodeResultBtn")?.addEventListener("click", () => {
      document.getElementById("codeResultBox")?.classList.add("hidden");
    });

    document.getElementById("copyCodeBtn")?.addEventListener("click", () => {
      const code     = document.getElementById("codeDisplay")?.textContent || "";
      const feedback = document.getElementById("codeCopyFeedback");
      copyToClipboard(code, feedback);
    });
  }

  return { loadAdminGroups, renderGrupos, gruposGoTo, wireEvents };
}
