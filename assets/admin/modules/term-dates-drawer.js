import { fetchJSON } from "./adminUtils.js";
import { createUnsavedChangesGuard } from "../../shared/js/unsavedChanges/unsavedChangesGuard.js";
import { snapshotFormValues } from "../../shared/js/unsavedChanges/snapshotFormValues.js";
import { attachCierreConGuarda } from "../../shared/js/unsavedChanges/attachCierreConGuarda.js";

export function initTermDatesDrawer() {

  // ── Overlay HTML ─────────────────────────────────────────────────────────

  const overlay = document.createElement("div");
  overlay.className = "av-drawer-overlay";
  overlay.id = "termDatesDrawer";
  overlay.innerHTML = `
    <div class="av-drawer" role="dialog" aria-modal="true" aria-labelledby="tdDrawerTitle">
      <div class="av-drawer-head">
        <div class="av-drawer-head-info">
          <div class="av-drawer-title" id="tdDrawerTitle">Fechas de trimestre</div>
        </div>
        <button class="av-icon-btn" id="tdCloseBtn" type="button" title="Cerrar">×</button>
      </div>

      <div class="av-drawer-body">
        <table class="td-term-table">
          <thead>
            <tr>
              <th></th>
              <th>Inicio</th>
              <th>Fin</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="td-term-label">T1</td>
              <td><input class="av-input td-term-input" id="tdStart1" type="date" /></td>
              <td><input class="av-input td-term-input" id="tdEnd1"   type="date" /></td>
            </tr>
            <tr>
              <td class="td-term-label">T2</td>
              <td><input class="av-input td-term-input" id="tdStart2" type="date" /></td>
              <td><input class="av-input td-term-input" id="tdEnd2"   type="date" /></td>
            </tr>
            <tr>
              <td class="td-term-label">T3</td>
              <td><input class="av-input td-term-input" id="tdStart3" type="date" /></td>
              <td><input class="av-input td-term-input" id="tdEnd3"   type="date" /></td>
            </tr>
          </tbody>
        </table>
        <div id="tdMsg" class="av-drawer-msg" hidden></div>
      </div>

      <div class="av-drawer-foot">
        <div class="av-drawer-foot-right">
          <button class="btn ghost"   id="tdCancelBtn" type="button">Cancelar</button>
          <button class="btn primary" id="tdSaveBtn"   type="button">Guardar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // ── DOM refs ─────────────────────────────────────────────────────────────

  const msgEl   = overlay.querySelector("#tdMsg");
  const saveBtn = overlay.querySelector("#tdSaveBtn");

  // ── Helpers ───────────────────────────────────────────────────────────────

  function showMsg(text, type = "error") {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = `av-drawer-msg ${type}`;
    msgEl.hidden = !text;
  }

  function clearMsg() { showMsg(""); }

  const guard = createUnsavedChangesGuard({ getSnapshot: () => snapshotFormValues(overlay) });
  const intentarCerrarAccidental = attachCierreConGuarda({ guard, cerrarFn: close });

  function getInputs() {
    return [1, 2, 3].map((t) => ({
      start: overlay.querySelector(`#tdStart${t}`),
      end:   overlay.querySelector(`#tdEnd${t}`),
      t,
    }));
  }

  // ── Open / close ──────────────────────────────────────────────────────────

  async function open() {
    clearMsg();
    overlay.classList.add("open");

    try {
      const rows = await fetchJSON("/api/v1/term-dates");
      const data = Array.isArray(rows) ? rows : [];
      for (const { start, end, t } of getInputs()) {
        const row = data.find((r) => r.trimester === t);
        if (start) start.value = row?.start_date || "";
        if (end)   end.value   = row?.end_date   || "";
      }
    } catch (err) {
      showMsg("No se pudieron cargar las fechas actuales.");
    }

    guard.marcarLimpio();
    overlay.querySelector("#tdStart1")?.focus();
  }

  function close() {
    overlay.classList.remove("open");
    clearMsg();
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    clearMsg();

    const rows = getInputs().map(({ start, end, t }) => ({
      trimester:  t,
      start_date: start?.value || "",
      end_date:   end?.value   || "",
    }));

    for (const row of rows) {
      if (!row.start_date || !row.end_date) {
        showMsg("Completa todas las fechas.");
        return;
      }
      if (row.start_date >= row.end_date) {
        showMsg(`T${row.trimester}: la fecha de inicio debe ser anterior a la de fin.`);
        return;
      }
    }

    saveBtn.disabled = true;
    try {
      await fetchJSON("/api/v1/term-dates", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(rows),
      });
      close();
    } catch (err) {
      showMsg(err?.message || "Error al guardar. Inténtalo de nuevo.");
    } finally {
      saveBtn.disabled = false;
    }
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) intentarCerrarAccidental();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && overlay.classList.contains("open")) intentarCerrarAccidental();
  });

  overlay.querySelector("#tdCloseBtn")?.addEventListener("click", close);
  overlay.querySelector("#tdCancelBtn")?.addEventListener("click", close);
  overlay.querySelector("#tdSaveBtn")?.addEventListener("click", () => save().catch(console.error));

  return { open, close };
}
