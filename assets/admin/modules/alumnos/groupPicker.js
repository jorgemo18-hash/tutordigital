import { escHtml, fetchJSON } from "../adminUtils.js";

// Selector de grupo en 2 pasos (curso → vía) para el panel "+ Invitar
// alumno" de la vista cross-grupo (allStudentsTab.js). Estado propio
// encapsulado en el factory — no es scope de un padre, es el estado privado
// de este widget concreto (mismo criterio que sharedDrawer en diario.js).

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

export function createGroupPicker() {
  let step = 0; // 0=cerrado, 1=curso, 2=vía
  let course = null; // {stage, year, label}
  let selectedGroupId = null;

  function render(state) {
    const el = document.getElementById("studentGroupPicker");
    if (!el) return;
    const groups = state.adminGroups?.length ? state.adminGroups : (state.allGroups || []);
    const sendBtn = document.getElementById("sendInviteStudentBtn");

    if (step === 0) {
      const sel = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : null;
      if (sel) {
        el.innerHTML = `
          <div class="av-assign-item">
            <div class="av-letter">${escHtml(sGroupLetter(sel))}</div>
            <div><div class="av-assign-name">${escHtml(sel.name)}</div></div>
            <button class="av-icon-btn danger" data-clear-student-group type="button" title="Quitar">×</button>
          </div>`;
      } else {
        el.innerHTML = `<button class="av-add-group-btn" data-open-student-picker type="button">Elegir grupo</button>`;
      }
      if (sendBtn) {
        const hasEmail = String(document.getElementById("inviteStudentEmail")?.value || "").includes("@");
        sendBtn.disabled = !(hasEmail && selectedGroupId);
      }
      return;
    }

    if (step === 1) {
      const courses = sCoursesFromGroups(groups);
      if (!courses.length) {
        el.innerHTML = `<div class="av-group-picker">
          <div class="av-group-picker-head"><span class="av-label">Elige el curso</span>
            <button class="av-icon-btn" data-cancel-student-picker type="button">×</button></div>
          <p class="av-no-assign">No hay grupos disponibles.</p></div>`;
        return;
      }
      const byStage = {};
      for (const c of courses) (byStage[c.stage] = byStage[c.stage] || []).push(c);
      const stagesHtml = S_STAGE_KEYS.filter(s => byStage[s]).map(s => {
        const chips = byStage[s].map(c =>
          `<span class="av-subject-chip" data-student-pick-course="${escHtml(c.key)}">${escHtml(c.label)}</span>`
        ).join("");
        return `<div class="av-group-picker-stage"><span class="av-label">${escHtml(S_STAGE_LABEL[s])}</span>
          <div class="av-subject-pick">${chips}</div></div>`;
      }).join("");
      el.innerHTML = `<div class="av-group-picker">
        <div class="av-group-picker-head"><span class="av-label">Elige el curso</span>
          <button class="av-icon-btn" data-cancel-student-picker type="button" title="Cerrar">×</button></div>
        ${stagesHtml}</div>`;
      return;
    }

    if (step === 2 && course) {
      const vias = groups.filter(g =>
        sInferStage(g) === course.stage && sInferYear(g) === course.year
      );
      const chips = vias.map(g =>
        `<span class="av-subject-chip" data-student-pick-via="${escHtml(g.id)}" title="${escHtml(g.name)}">${escHtml(sExtractTrack(g))}</span>`
      ).join("");
      el.innerHTML = `<div class="av-group-picker">
        <div class="av-group-picker-head">
          <span class="av-label">${escHtml(course.label)} — elige vía</span>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn ghost small" data-student-back-to-step1 type="button">← Curso</button>
            <button class="av-icon-btn" data-cancel-student-picker type="button" title="Cerrar">×</button>
          </div>
        </div>
        <div class="av-subject-pick">${chips}</div>
      </div>`;
    }
  }

  function refreshInviteBtn() {
    const email     = String(document.getElementById("inviteStudentEmail")?.value || "").trim();
    const firstName = String(document.getElementById("inviteStudentFirstName")?.value || "").trim();
    const lastName  = String(document.getElementById("inviteStudentLastName")?.value || "").trim();
    const btn       = document.getElementById("sendInviteStudentBtn");
    if (btn) btn.disabled = !(email.includes("@") && firstName && lastName && selectedGroupId);
  }

  function closePanel(state) {
    document.getElementById("inviteStudentPanel")?.classList.add("hidden");
    const showBtn = document.getElementById("showInviteStudentBtn");
    if (showBtn) showBtn.textContent = "+ Invitar alumno";
    const fields = ["inviteStudentEmail", "inviteStudentFirstName", "inviteStudentLastName"];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    step = 0;
    course = null;
    selectedGroupId = null;
    render(state);
    const sendBtn = document.getElementById("sendInviteStudentBtn");
    if (sendBtn) sendBtn.disabled = true;
  }

  async function inviteFromTab(state, { onDone }) {
    const email     = String(document.getElementById("inviteStudentEmail")?.value || "").trim().toLowerCase();
    const firstName = String(document.getElementById("inviteStudentFirstName")?.value || "").trim();
    const lastName  = String(document.getElementById("inviteStudentLastName")?.value || "").trim();
    const errEl     = document.getElementById("alumnosError");
    const btn       = document.getElementById("sendInviteStudentBtn");
    if (errEl) errEl.textContent = "";

    if (!email || !email.includes("@"))  { if (errEl) errEl.textContent = "Introduce un email válido."; return; }
    if (!firstName)                       { if (errEl) errEl.textContent = "Introduce el nombre del alumno."; return; }
    if (!lastName)                        { if (errEl) errEl.textContent = "Introduce los apellidos del alumno."; return; }
    if (!selectedGroupId)                 { if (errEl) errEl.textContent = "Elige un grupo."; return; }

    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
    try {
      await fetchJSON(`/api/v1/admin/groups/${selectedGroupId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, first_name: firstName, last_name: lastName }),
      });
      closePanel(state);
      await onDone();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo crear la invitación.";
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Enviar invitación"; }
    }
  }

  function handleClick(ev, state) {
    if (ev.target.closest("[data-open-student-picker]")) {
      step = 1; render(state); return true;
    }
    const courseChip = ev.target.closest("[data-student-pick-course]");
    if (courseChip) {
      const [stage, yearStr] = courseChip.dataset.studentPickCourse.split("|");
      course = { stage, year: Number(yearStr), label: `${S_STAGE_LABEL[stage] || stage} ${yearStr}º` };
      step = 2; render(state); return true;
    }
    const viaChip = ev.target.closest("[data-student-pick-via]");
    if (viaChip) {
      selectedGroupId = viaChip.dataset.studentPickVia;
      step = 0; course = null;
      render(state); refreshInviteBtn(); return true;
    }
    if (ev.target.closest("[data-student-back-to-step1]")) {
      step = 1; course = null; render(state); return true;
    }
    if (ev.target.closest("[data-cancel-student-picker]")) {
      step = 0; course = null; render(state); return true;
    }
    if (ev.target.closest("[data-clear-student-group]")) {
      selectedGroupId = null; render(state); refreshInviteBtn(); return true;
    }
    return false;
  }

  function openPanel(state) {
    step = 0;
    document.getElementById("inviteStudentPanel")?.classList.remove("hidden");
    document.getElementById("showInviteStudentBtn").textContent = "× Cancelar";
    render(state);
    document.getElementById("inviteStudentFirstName")?.focus();
  }

  return { render, closePanel, openPanel, refreshInviteBtn, inviteFromTab, handleClick };
}
