import { fetchJSON } from "./adminUtils.js";

const STAGE_YEARS  = { primaria: [1,2,3,4,5,6], eso: [1,2,3,4], bachiller: [1,2] };
const STAGE_LABELS = { primaria: "Primaria", eso: "ESO", bachiller: "Bachillerato" };
const FIXED_TRACKS = ["A","B","C","D","NEAE","PAI"];

function autoName(stage, year, track) {
  return `${year}º ${STAGE_LABELS[stage]} ${track}`;
}

export function initCreateGroupForm({ onGroupCreated, onCancel }) {
  const stageRow     = document.getElementById("cgfStageRow");
  const yearStep     = document.getElementById("cgfYearStep");
  const yearRow      = document.getElementById("cgfYearRow");
  const trackStep    = document.getElementById("cgfTrackStep");
  const trackRow     = document.getElementById("cgfTrackRow");
  const customInputs = document.getElementById("cgfCustomInputs");
  const preview      = document.getElementById("cgfPreview");
  const previewList  = document.getElementById("cgfPreviewList");
  const submitRow    = document.getElementById("createGroupSubmitRow");
  const createBtn    = document.getElementById("createGroupBtn");
  const cancelBtn    = document.getElementById("cancelCreateGroupBtn");
  const errorEl      = document.getElementById("createGroupError");

  let stage = null, year = null, customCount = 0;
  const selectedTracks = new Set();

  function getCustomTracks() {
    return Array.from(customInputs.querySelectorAll(".cgf-custom-input"))
      .map(inp => inp.value.trim()).filter(Boolean);
  }

  function allTracks() {
    return [...selectedTracks, ...getCustomTracks()];
  }

  function updatePreview() {
    const tracks = allTracks();
    const show = !!(stage && year && tracks.length);
    preview.classList.toggle("hidden", !show);
    submitRow.classList.toggle("hidden", !show);
    if (!show) return;
    createBtn.textContent = tracks.length === 1 ? "Crear grupo" : `Crear ${tracks.length} grupos`;
    previewList.innerHTML = tracks.map((t, i) =>
      `<div class="cgf-preview-item">
        <span class="cgf-preview-idx">${i + 1}.</span>
        <input class="cgf-name-input" type="text" value="${autoName(stage, year, t)}" data-index="${i}" autocomplete="off" />
      </div>`
    ).join("");
  }

  function renderYears(s) {
    yearRow.innerHTML = (STAGE_YEARS[s] || []).map(y =>
      `<button type="button" class="cgf-chip" data-year="${y}">${y}º</button>`
    ).join("");
    yearStep.classList.remove("hidden");
  }

  stageRow.addEventListener("click", e => {
    const btn = e.target.closest("[data-stage]");
    if (!btn) return;
    stage = btn.dataset.stage;
    year = null;
    selectedTracks.clear();
    customInputs.innerHTML = "";
    customCount = 0;
    stageRow.querySelectorAll("[data-stage]").forEach(b =>
      b.classList.toggle("active", b.dataset.stage === stage));
    renderYears(stage);
    trackStep.classList.add("hidden");
    yearRow.querySelectorAll("[data-year]").forEach(b => b.classList.remove("active"));
    updatePreview();
  });

  yearRow.addEventListener("click", e => {
    const btn = e.target.closest("[data-year]");
    if (!btn) return;
    year = Number(btn.dataset.year);
    selectedTracks.clear();
    customInputs.innerHTML = "";
    customCount = 0;
    yearRow.querySelectorAll("[data-year]").forEach(b =>
      b.classList.toggle("active", Number(b.dataset.year) === year));
    trackStep.classList.remove("hidden");
    trackRow.querySelectorAll("[data-track]").forEach(b => b.classList.remove("active"));
    updatePreview();
  });

  trackRow.addEventListener("click", e => {
    const btn = e.target.closest("[data-track]");
    if (!btn) return;
    const t = btn.dataset.track;
    if (selectedTracks.has(t)) { selectedTracks.delete(t); btn.classList.remove("active"); }
    else                       { selectedTracks.add(t);    btn.classList.add("active");    }
    updatePreview();
  });

  document.getElementById("cgfOtroBtn").addEventListener("click", () => {
    customCount++;
    const wrap = document.createElement("div");
    wrap.className = "cgf-custom-wrap";
    wrap.innerHTML = `<input class="cgf-custom-input" type="text"
      placeholder="Ej: REFUERZO, PMAR, DESDOBLE…" maxlength="32" autocomplete="off" />
      <button type="button" class="cgf-custom-remove" aria-label="Eliminar">×</button>`;
    customInputs.appendChild(wrap);
    wrap.querySelector("input").focus();
    wrap.querySelector("input").addEventListener("input", updatePreview);
    wrap.querySelector(".cgf-custom-remove").addEventListener("click", () => {
      wrap.remove(); updatePreview();
    });
    updatePreview();
  });

  cancelBtn.addEventListener("click", () => { resetForm(); onCancel?.(); });

  createBtn.addEventListener("click", () => doCreate().catch(err => {
    if (errorEl) errorEl.textContent = err?.message || "Error al crear grupos.";
  }));

  async function doCreate() {
    if (!stage || !year) return;
    const tracks = allTracks();
    if (!tracks.length) return;
    const names = Array.from(previewList.querySelectorAll(".cgf-name-input")).map(i => i.value.trim());
    if (names.some(n => !n)) {
      if (errorEl) errorEl.textContent = "Todos los grupos deben tener nombre.";
      return;
    }
    createBtn.disabled = true;
    createBtn.textContent = "Creando…";
    if (errorEl) errorEl.textContent = "";

    const results = [], errors = [];
    for (let i = 0; i < tracks.length; i++) {
      try {
        const res = await fetchJSON("/api/v1/admin/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: names[i], stage, year, track: tracks[i] }),
        });
        results.push(res);
      } catch (err) {
        errors.push(`${names[i]}: ${err?.message || "error"}`);
      }
    }

    createBtn.disabled = false;
    createBtn.textContent = "Crear grupo";

    if (errors.length && !results.length) {
      if (errorEl) errorEl.textContent = errors.join(" · ");
      return;
    }
    if (errors.length && errorEl) {
      errorEl.textContent = `Parcial — no creados: ${errors.join(" · ")}`;
    }

    onGroupCreated?.(results, stage, year);
    if (!errors.length) resetForm();
  }

  function resetForm() {
    stage = null; year = null;
    selectedTracks.clear();
    customInputs.innerHTML = "";
    customCount = 0;
    stageRow.querySelectorAll("[data-stage]").forEach(b => b.classList.remove("active"));
    if (yearRow) yearRow.innerHTML = "";
    yearStep.classList.add("hidden");
    trackStep.classList.add("hidden");
    trackRow.querySelectorAll("[data-track]").forEach(b => b.classList.remove("active"));
    preview.classList.add("hidden");
    submitRow.classList.add("hidden");
    if (errorEl) errorEl.textContent = "";
  }

  return { resetForm };
}
