import { escHtml, fetchJSON } from "../adminUtils.js";

// Import masivo en dos fases: subir archivo -> revisar -> confirmar.
// Sustituye al antiguo "pegar emails en un textarea" (import a ciegas, sin
// nombres ni feedback por fila). La previsualización (POST .../import/preview)
// no persiste nada — solo tras "Invitar a los N seleccionados" se llama a
// POST .../import, que crea las invitaciones y manda los emails. Ningún
// estado intermedio se guarda: cerrar el formulario o volver a subir el
// archivo es el mecanismo de "reintentar".
//
// `ids` y `getGroup` son explícitos (no cierran sobre `state.
// activeGroupForStudents` por defecto en el interior) para que este mismo
// flujo pueda montarse dos veces en la página sin pisarse: una vez dentro
// de Grupos → grupo (ids por defecto, grupo ya fijado en el estado) y otra
// desde el punto de entrada "Importar lista" de la pestaña Alumnos
// (alumnosImportEntry.js), que le pasa sus propios ids de DOM y el grupo
// elegido en su propio selector.

const DEFAULT_IDS = {
  fileInputId: "importFileInput",
  reviewWrapId: "importReview",
  reviewTableId: "importReviewTable",
  confirmBtnId: "importConfirmBtn",
  resultId: "importResult",
  errorId: "importError",
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

const STATUS_LABELS = { listo: "Listo", email_invalido: "Email inválido", duplicado: "Duplicado" };
const STATUS_BADGE_CLASS = { listo: "ok", email_invalido: "rechazado", duplicado: "archivado" };

export function createGroupImport({ ids, getGroup } = {}) {
  const { fileInputId, reviewWrapId, reviewTableId, confirmBtnId, resultId, errorId } = { ...DEFAULT_IDS, ...ids };
  const resolveGroup = getGroup || ((state) => state.activeGroupForStudents);

  let reviewRows = [];
  let selected = new Set();

  function renderReview() {
    const tableEl = document.getElementById(reviewTableId);
    const wrapEl = document.getElementById(reviewWrapId);
    const confirmBtn = document.getElementById(confirmBtnId);
    if (!tableEl || !wrapEl) return;

    wrapEl.classList.toggle("hidden", reviewRows.length === 0);
    tableEl.innerHTML = reviewRows.map((row, i) => {
      const checked = selected.has(i) ? "checked" : "";
      const disabled = row.selectable ? "" : "disabled";
      const reasonHtml = row.reason ? `<div class="av-cell-sub">${escHtml(row.reason)}</div>` : "";
      return `
        <label class="av-row" style="cursor:${row.selectable ? "pointer" : "default"}">
          <input type="checkbox" data-import-row="${i}" ${checked} ${disabled} />
          <div>
            <div class="av-row-name">${escHtml(row.name || "(sin nombre)")}</div>
            <div class="av-cell-sub">${escHtml(row.email || "sin email")}</div>
            ${reasonHtml}
          </div>
          <span class="av-status ${STATUS_BADGE_CLASS[row.status] || ""}">${escHtml(STATUS_LABELS[row.status] || row.status)}</span>
        </label>`;
    }).join("");

    if (confirmBtn) {
      confirmBtn.disabled = selected.size === 0;
      confirmBtn.textContent = `Invitar a los ${selected.size} seleccionados`;
    }
  }

  function resetReview({ keepResult = false } = {}) {
    reviewRows = [];
    selected = new Set();
    if (!keepResult) {
      const resultEl = document.getElementById(resultId);
      if (resultEl) resultEl.textContent = "";
    }
    renderReview();
  }

  async function handleFileChosen(state) {
    const input = document.getElementById(fileInputId);
    const errEl = document.getElementById(errorId);
    const file = input?.files?.[0];
    if (!file) return;
    if (errEl) errEl.textContent = "";
    resetReview();

    const group = resolveGroup(state);
    if (!group) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students/import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, data: dataUrl }),
      });
      reviewRows = data?.rows || [];
      selected = new Set(reviewRows.map((r, i) => (r.selectable ? i : null)).filter((i) => i !== null));
      renderReview();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo procesar el archivo.";
    } finally {
      if (input) input.value = "";
    }
  }

  function toggleRow(index) {
    const row = reviewRows[index];
    if (!row?.selectable) return;
    if (selected.has(index)) selected.delete(index);
    else selected.add(index);
    renderReview();
  }

  async function confirmImport(state, { onDone }) {
    const group = resolveGroup(state);
    if (!group || !selected.size) return;
    const btn = document.getElementById(confirmBtnId);
    const resultEl = document.getElementById(resultId);
    const errEl = document.getElementById(errorId);
    if (errEl) errEl.textContent = "";
    if (btn) { btn.disabled = true; btn.textContent = "Invitando…"; }

    const rows = [...selected].map((i) => ({ email: reviewRows[i].email, name: reviewRows[i].name }));
    try {
      const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (resultEl) resultEl.textContent = `✓ ${data.invited} invitado(s), ${data.skipped} omitido(s) de ${data.total_submitted}.`;
      resetReview({ keepResult: true });
      await onDone();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo importar la lista.";
      renderReview();
    }
  }

  function handleClick(ev, state, { onDone }) {
    const checkbox = ev.target.closest("[data-import-row]");
    if (checkbox) { toggleRow(Number(checkbox.dataset.importRow)); return true; }
    if (ev.target.closest(`#${confirmBtnId}`)) { confirmImport(state, { onDone }).catch(console.error); return true; }
    return false;
  }

  return { handleFileChosen, handleClick, resetReview };
}
