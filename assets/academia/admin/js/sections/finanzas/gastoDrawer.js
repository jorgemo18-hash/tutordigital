import { buildGastoFormFields } from "./gastoFormFields.js";
import { buildGastoUpload } from "./gastoUpload.js";
import { buildGastoFotoBlock } from "./gastoFotoBlock.js";
import { buildIcon } from "../../icons.js";

// Drawer lateral de gastos — sin argumento, `open()` crea un gasto nuevo
// (título "Nuevo gasto", botón "Subir factura" con OCR); con un gasto
// existente, `open(gasto)` entra en modo detalle/edición (título con el
// proveedor, foto ya subida o botón para subirla, "Guardar cambios" y
// "Eliminar"). `onGuardar`/`onActualizar`/`onEliminar` reciben los datos
// ya calculados (IVA, retención, total) y deciden cómo persistirlos.
export function createGastoDrawer(root, { onGuardar, onActualizar, onEliminar, desgloseIva = false }) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  function close() {
    overlay.classList.remove("open");
  }

  function buildFoot({ esNuevo, gastoActual, fields, msg }) {
    const foot = document.createElement("div");
    foot.className = "ac-drawer-foot";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ac-btn ghost";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", close);

    const right = document.createElement("div");
    right.className = "ac-drawer-foot-right";

    if (!esNuevo) {
      const eliminarBtn = document.createElement("button");
      eliminarBtn.type = "button";
      eliminarBtn.className = "ac-btn danger";
      eliminarBtn.textContent = "Eliminar";
      eliminarBtn.addEventListener("click", async () => {
        if (!window.confirm("¿Eliminar este gasto? Esta acción no se puede deshacer.")) return;
        eliminarBtn.disabled = true;
        try {
          await onEliminar(gastoActual.id);
          close();
        } catch (err) {
          msg.textContent = err.message || "No se pudo eliminar el gasto.";
          msg.className = "ac-drawer-msg error";
          eliminarBtn.disabled = false;
        }
      });
      right.appendChild(eliminarBtn);
    }

    const guardarBtn = document.createElement("button");
    guardarBtn.type = "button";
    guardarBtn.className = "ac-btn primary";
    guardarBtn.textContent = esNuevo ? "Guardar gasto" : "Guardar cambios";
    guardarBtn.addEventListener("click", async () => {
      const errorValidacion = fields.validar();
      if (errorValidacion) {
        msg.textContent = errorValidacion;
        msg.className = "ac-drawer-msg error";
        return;
      }
      guardarBtn.disabled = true;
      msg.textContent = "";
      try {
        const valores = fields.leerValores();
        if (esNuevo) await onGuardar(valores);
        else await onActualizar(gastoActual.id, valores);
        close();
      } catch (err) {
        msg.textContent = err.message || "No se pudo guardar el gasto.";
        msg.className = "ac-drawer-msg error";
        guardarBtn.disabled = false;
      }
    });
    right.appendChild(guardarBtn);

    foot.append(cancelBtn, right);
    return foot;
  }

  function render(gastoActual) {
    drawer.innerHTML = "";
    const esNuevo = !gastoActual;

    const head = document.createElement("div");
    head.className = "ac-drawer-head";
    const title = document.createElement("div");
    title.className = "ac-drawer-title";
    title.textContent = esNuevo ? "Nuevo gasto" : `Gasto — ${gastoActual.proveedor || "—"}`;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ac-drawer-close";
    closeBtn.appendChild(buildIcon("close", { size: 14 }));
    closeBtn.addEventListener("click", close);
    head.append(title, closeBtn);

    const fields = buildGastoFormFields(gastoActual, { desgloseIva });
    const body = document.createElement("div");
    body.className = "ac-drawer-body";
    body.appendChild(fields.wrap);

    const msg = document.createElement("div");
    msg.className = "ac-drawer-msg";

    const foot = buildFoot({ esNuevo, gastoActual, fields, msg });

    const fotoOUpload = esNuevo
      ? buildGastoUpload({ onExtraido: (datos) => fields.rellenarDesdeOcr(datos) })
      : buildGastoFotoBlock({
          fotoUrl: gastoActual.foto_url,
          gastoId: gastoActual.id,
          onFotoSubida: (url) => { gastoActual.foto_url = url; },
        });

    drawer.append(head, fotoOUpload, body, msg, foot);
  }

  function open(gasto) {
    render(gasto || null);
    overlay.classList.add("open");
  }

  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });

  return { open, close };
}
