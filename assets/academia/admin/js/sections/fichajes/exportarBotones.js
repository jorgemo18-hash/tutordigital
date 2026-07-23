import { descargarExportacionFichajes } from "../../apiFichajes.js";

// Dos botones de descarga directa (PDF/Excel) del período+trabajador que
// se esté viendo — mismo criterio de original/corrección sin fusionar que
// la tabla en pantalla (ver exportPdf.js/exportExcel.js en el backend).
export function buildExportarBotones({ getContexto, descargarFn = descargarExportacionFichajes }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-fichajes-exportar";

  const msg = document.createElement("span");
  msg.className = "ac-drawer-msg";

  function buildBoton(label, formato) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-btn ghost";
    btn.textContent = label;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      msg.textContent = "";
      try {
        const { workerProfileId, mes, anio } = getContexto();
        if (!workerProfileId) throw new Error("Elige antes un trabajador.");
        await descargarFn({ worker_profile_id: workerProfileId, mes, anio, formato });
      } catch (err) {
        msg.textContent = err.message || "No se pudo exportar.";
        msg.className = "ac-drawer-msg error";
      }
      btn.disabled = false;
    });
    return btn;
  }

  wrap.append(buildBoton("Exportar PDF", "pdf"), buildBoton("Exportar Excel", "xlsx"), msg);
  return wrap;
}
