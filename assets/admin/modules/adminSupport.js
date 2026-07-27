import { fetchJSON } from "./adminUtils.js";
import { createUnsavedChangesGuard } from "../../shared/js/unsavedChanges/unsavedChangesGuard.js";
import { snapshotFormValues } from "../../shared/js/unsavedChanges/snapshotFormValues.js";
import { attachCierreConGuarda } from "../../shared/js/unsavedChanges/attachCierreConGuarda.js";

export function initSupportModal() {
  const MODAL = "supportModal";

  function getEl(id) { return document.getElementById(id); }

  const guard = createUnsavedChangesGuard({ getSnapshot: () => snapshotFormValues(getEl(MODAL)) });
  const intentarCerrarAccidental = attachCierreConGuarda({ guard, cerrarFn: close });

  function open() {
    const modal = getEl(MODAL);
    if (!modal) return;
    getEl("supportSubject").value   = "Problema técnico";
    getEl("supportMessage").value   = "";
    getEl("supportError").textContent = "";
    getEl("supportConfirm")?.classList.add("hidden");
    getEl("supportFormBody")?.classList.remove("hidden");
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    guard.marcarLimpio();
    getEl("supportMessage")?.focus();
  }

  function close() {
    const modal = getEl(MODAL);
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  async function submit() {
    const subject = getEl("supportSubject")?.value || "Otro";
    const message = String(getEl("supportMessage")?.value || "").trim();
    const errEl   = getEl("supportError");
    if (errEl) errEl.textContent = "";
    if (!message) { if (errEl) errEl.textContent = "El mensaje no puede estar vacío."; return; }

    const btn = getEl("supportSubmitBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }

    try {
      await fetchJSON("/api/v1/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      getEl("supportFormBody")?.classList.add("hidden");
      getEl("supportConfirm")?.classList.remove("hidden");
      setTimeout(close, 3000);
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo enviar el mensaje.";
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Enviar"; }
    }
  }

  function wireEvents() {
    getEl("supportCloseBtn")?.addEventListener("click", close);
    getEl("supportCancelBtn")?.addEventListener("click", close);
    getEl("supportSubmitBtn")?.addEventListener("click", () => submit().catch(console.error));
    getEl("supportMessage")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit().catch(console.error);
    });
    // Cerrar al hacer clic fuera del panel
    getEl(MODAL)?.addEventListener("click", (ev) => {
      if (ev.target === getEl(MODAL)) intentarCerrarAccidental();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !getEl(MODAL)?.classList.contains("hidden")) intentarCerrarAccidental();
    });
  }

  wireEvents();
  return { open };
}
