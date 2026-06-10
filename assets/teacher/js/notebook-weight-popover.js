import { apiFetch } from "../../shared/js/auth.js";

let _popover = null;
let _popoverAbort = null;

function getOrCreatePopover() {
  if (_popover) return _popover;
  const el = document.createElement("div");
  el.className = "nbWeightPopover";
  el.innerHTML = `
    <div class="nbWeightHead">
      <span class="nbWeightTitle">Pesos de nota media</span>
      <button class="nbWeightClose" type="button" aria-label="Cerrar">✕</button>
    </div>
    <div class="nbWeightSubjectRow" id="nbWeightSubjectRow" style="display:none">
      <label class="nbWeightLbl">Asignatura</label>
      <select class="nbWeightSelect" id="nbWeightSubjectSel"></select>
    </div>
    <div class="nbWeightForm" id="nbWeightForm">
      <label class="nbWeightRow"><span class="nbWeightRowLbl">Exámenes</span>
        <span class="nbWeightInputWrap"><input class="nbWeightInput" id="nbWExam" type="number" min="0" max="100" step="1"><span class="nbWeightUnit">%</span></span>
      </label>
      <label class="nbWeightRow"><span class="nbWeightRowLbl">Trabajos</span>
        <span class="nbWeightInputWrap"><input class="nbWeightInput" id="nbWWork" type="number" min="0" max="100" step="1"><span class="nbWeightUnit">%</span></span>
      </label>
      <label class="nbWeightRow"><span class="nbWeightRowLbl">Tareas / deberes</span>
        <span class="nbWeightInputWrap"><input class="nbWeightInput" id="nbWHw" type="number" min="0" max="100" step="1"><span class="nbWeightUnit">%</span></span>
      </label>
      <p class="nbWeightTotal" id="nbWeightTotal">Total: 100%</p>
      <button class="nbWeightSave btn" id="nbWeightSave" type="button">Guardar</button>
      <p class="nbWeightErr" id="nbWeightErr" style="display:none"></p>
    </div>
  `;
  document.body.appendChild(el);
  _popover = el;
  return el;
}

function _closePopover() {
  if (_popover) _popover.classList.remove("open");
  if (_popoverAbort) { _popoverAbort.abort(); _popoverAbort = null; }
}

export function openWeightPopover(anchorBtn, subjects, currentWeights, trimester) {
  const pop = getOrCreatePopover();
  const rect = anchorBtn.getBoundingClientRect();
  pop.style.top  = `${rect.bottom + 6 + window.scrollY}px`;
  pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 280))}px`;

  const subjectRow = pop.querySelector("#nbWeightSubjectRow");
  const subjectSel = pop.querySelector("#nbWeightSubjectSel");
  if (subjects.length > 1) {
    subjectSel.innerHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    subjectRow.style.display = "flex";
  } else {
    subjectRow.style.display = "none";
  }

  function updateTotal() {
    const sum = [pop.querySelector("#nbWExam"), pop.querySelector("#nbWWork"), pop.querySelector("#nbWHw")]
      .reduce((a, inp) => a + (parseFloat(inp.value) || 0), 0);
    const totalEl = pop.querySelector("#nbWeightTotal");
    totalEl.textContent = `Total: ${Math.round(sum * 100) / 100}%`;
    totalEl.classList.toggle("nbWeightTotal--err", Math.round(sum) !== 100);
  }

  function fillInputs(subjectId) {
    const w = currentWeights.find(w => w.subject_id === subjectId) || { exam_pct: 60, work_pct: 20, homework_pct: 20 };
    pop.querySelector("#nbWExam").value = w.exam_pct;
    pop.querySelector("#nbWWork").value = w.work_pct;
    pop.querySelector("#nbWHw").value   = w.homework_pct;
    updateTotal();
  }

  const firstSubjectId = subjects[0]?.id || null;
  fillInputs(firstSubjectId);

  const errEl = pop.querySelector("#nbWeightErr");
  errEl.style.display = "none";

  pop.classList.add("open");

  const ac = new AbortController();
  _popoverAbort = ac;

  pop.querySelector(".nbWeightClose").addEventListener("click", _closePopover, { signal: ac.signal });

  subjectSel.addEventListener("change", e => fillInputs(e.target.value), { signal: ac.signal });

  [pop.querySelector("#nbWExam"), pop.querySelector("#nbWWork"), pop.querySelector("#nbWHw")]
    .forEach(inp => inp.addEventListener("input", updateTotal, { signal: ac.signal }));

  pop.querySelector("#nbWeightSave").addEventListener("click", async () => {
    const subjectId = subjects.length > 1 ? subjectSel.value : firstSubjectId;
    if (!subjectId) return;
    const exam_pct     = parseFloat(pop.querySelector("#nbWExam").value) || 0;
    const work_pct     = parseFloat(pop.querySelector("#nbWWork").value) || 0;
    const homework_pct = parseFloat(pop.querySelector("#nbWHw").value)   || 0;
    if (Math.round((exam_pct + work_pct + homework_pct) * 100) !== 10000) {
      errEl.textContent = "Los porcentajes deben sumar exactamente 100.";
      errEl.style.display = "block";
      return;
    }
    errEl.style.display = "none";
    const saveBtn = pop.querySelector("#nbWeightSave");
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando…";
    try {
      const res = await apiFetch("/api/v1/grade-weights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_id: subjectId, trimester, exam_pct, work_pct, homework_pct }),
      });
      if (!res.ok) throw new Error("Error guardando pesos");
      _closePopover();
      window._tdRefreshNotebook?.();
    } catch {
      errEl.textContent = "Error al guardar. Inténtalo de nuevo.";
      errEl.style.display = "block";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar";
    }
  }, { signal: ac.signal });

  setTimeout(() => {
    document.addEventListener("click", e => {
      if (!pop.contains(e.target) && e.target !== anchorBtn) _closePopover();
    }, { once: true, signal: ac.signal });
  }, 0);
}
