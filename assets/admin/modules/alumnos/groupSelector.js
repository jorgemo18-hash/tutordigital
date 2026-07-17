import { escHtml } from "../adminUtils.js";

// Selector de grupo en 2 pasos (curso → vía), reutilizable. Extraído de
// groupPicker.js para que "+ Invitar alumno" y "Importar lista" (ambos en
// la pestaña Alumnos) compartan la misma lógica de selección sin duplicarla
// — este widget no sabe nada de invitar ni de importar: cada consumidor le
// pasa su propio `containerId` y un `onChange(groupId, state)` explícito.

const S_STAGE_KEYS  = ["primaria", "eso", "bachiller", "otros"];
const S_STAGE_LABEL = { primaria: "Primaria", eso: "ESO", bachiller: "Bachillerato", otros: "Otros" };

function sInferStage(g) {
  const raw = String(g.level || g.stage || g.name || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (raw.includes("prim")) return "primaria";
  if (raw.includes("eso") || raw.includes("secund")) return "eso";
  if (raw.includes("bach")) return "bachiller";
  return "otros";
}

function sInferYear(g) {
  const n = Number(g.year || 0);
  if (Number.isInteger(n) && n >= 1 && n <= 6) return n;
  const m = String(g.course || g.name || "").match(/\b([1-6])[ºo°]?/);
  return m ? Number(m[1]) : 0;
}

function sExtractTrack(g) {
  if (g.track) return String(g.track).toUpperCase().trim();
  const norm = String(g.normalized_name || "");
  if (norm.includes("|")) return norm.split("|").at(-1).toUpperCase().trim() || String(g.name || "").split(/\s+/).at(-1).toUpperCase();
  return String(g.name || "").trim().split(/\s+/).at(-1).toUpperCase();
}

function sCoursesFromGroups(groups) {
  const seen = new Map();
  for (const g of groups) {
    const stage = sInferStage(g);
    const year  = sInferYear(g);
    if (!year) continue;
    const key = `${stage}|${year}`;
    if (!seen.has(key)) {
      seen.set(key, { stage, year, key, label: `${S_STAGE_LABEL[stage] || stage} ${year}º` });
    }
  }
  return [...seen.values()].sort((a, b) => {
    const si = S_STAGE_KEYS.indexOf(a.stage) - S_STAGE_KEYS.indexOf(b.stage);
    return si !== 0 ? si : a.year - b.year;
  });
}

function sGroupLetter(g) {
  const s = sInferStage(g);
  return s === "bachiller" ? "B" : s === "eso" ? "E" : s === "primaria" ? "P" : "?";
}

export function createGroupSelector({ containerId, onChange }) {
  let step = 0; // 0=cerrado, 1=curso, 2=vía
  let course = null; // {stage, year, label}
  let selectedGroupId = null;

  function render(state) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const groups = state.adminGroups?.length ? state.adminGroups : (state.allGroups || []);

    if (step === 0) {
      const sel = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : null;
      if (sel) {
        el.innerHTML = `
          <div class="av-assign-item">
            <div class="av-letter">${escHtml(sGroupLetter(sel))}</div>
            <div><div class="av-assign-name">${escHtml(sel.name)}</div></div>
            <button class="av-icon-btn danger" data-clear-group="${containerId}" type="button" title="Quitar">×</button>
          </div>`;
      } else {
        el.innerHTML = `<button class="av-add-group-btn" data-open-picker="${containerId}" type="button">Elegir grupo</button>`;
      }
      return;
    }

    if (step === 1) {
      const courses = sCoursesFromGroups(groups);
      if (!courses.length) {
        el.innerHTML = `<div class="av-group-picker">
          <div class="av-group-picker-head"><span class="av-label">Elige el curso</span>
            <button class="av-icon-btn" data-cancel-picker="${containerId}" type="button">×</button></div>
          <p class="av-no-assign">No hay grupos disponibles.</p></div>`;
        return;
      }
      const byStage = {};
      for (const c of courses) (byStage[c.stage] = byStage[c.stage] || []).push(c);
      const stagesHtml = S_STAGE_KEYS.filter(s => byStage[s]).map(s => {
        const chips = byStage[s].map(c =>
          `<span class="av-subject-chip" data-pick-course="${containerId}|${escHtml(c.key)}">${escHtml(c.label)}</span>`
        ).join("");
        return `<div class="av-group-picker-stage"><span class="av-label">${escHtml(S_STAGE_LABEL[s])}</span>
          <div class="av-subject-pick">${chips}</div></div>`;
      }).join("");
      el.innerHTML = `<div class="av-group-picker">
        <div class="av-group-picker-head"><span class="av-label">Elige el curso</span>
          <button class="av-icon-btn" data-cancel-picker="${containerId}" type="button" title="Cerrar">×</button></div>
        ${stagesHtml}</div>`;
      return;
    }

    if (step === 2 && course) {
      const vias = groups.filter(g =>
        sInferStage(g) === course.stage && sInferYear(g) === course.year
      );
      const chips = vias.map(g =>
        `<span class="av-subject-chip" data-pick-via="${containerId}|${escHtml(g.id)}" title="${escHtml(g.name)}">${escHtml(sExtractTrack(g))}</span>`
      ).join("");
      el.innerHTML = `<div class="av-group-picker">
        <div class="av-group-picker-head">
          <span class="av-label">${escHtml(course.label)} — elige vía</span>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn ghost small" data-back-to-step1="${containerId}" type="button">← Curso</button>
            <button class="av-icon-btn" data-cancel-picker="${containerId}" type="button" title="Cerrar">×</button>
          </div>
        </div>
        <div class="av-subject-pick">${chips}</div>
      </div>`;
    }
  }

  function handleClick(ev, state) {
    const openBtn = ev.target.closest(`[data-open-picker="${containerId}"]`);
    if (openBtn) { step = 1; render(state); return true; }

    const courseChip = ev.target.closest(`[data-pick-course^="${containerId}|"]`);
    if (courseChip) {
      const [, stage, yearStr] = courseChip.dataset.pickCourse.split("|");
      course = { stage, year: Number(yearStr), label: `${S_STAGE_LABEL[stage] || stage} ${yearStr}º` };
      step = 2; render(state); return true;
    }

    const viaChip = ev.target.closest(`[data-pick-via^="${containerId}|"]`);
    if (viaChip) {
      selectedGroupId = viaChip.dataset.pickVia.slice(containerId.length + 1);
      step = 0; course = null;
      render(state);
      onChange?.(selectedGroupId, state);
      return true;
    }

    if (ev.target.closest(`[data-back-to-step1="${containerId}"]`)) {
      step = 1; course = null; render(state); return true;
    }
    if (ev.target.closest(`[data-cancel-picker="${containerId}"]`)) {
      step = 0; course = null; render(state); return true;
    }
    if (ev.target.closest(`[data-clear-group="${containerId}"]`)) {
      selectedGroupId = null; render(state);
      onChange?.(null, state);
      return true;
    }
    return false;
  }

  function reset(state) {
    step = 0; course = null; selectedGroupId = null;
    render(state);
  }

  function getSelectedGroupId() {
    return selectedGroupId;
  }

  return { render, handleClick, reset, getSelectedGroupId };
}
