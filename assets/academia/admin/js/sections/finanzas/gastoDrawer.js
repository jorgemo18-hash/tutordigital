import { buildGastoFormFields } from "./gastoFormFields.js";
import { buildGastoUpload } from "./gastoUpload.js";
import { showToast } from "../../toast.js";
import { buildGastoFotoBlock } from "./gastoFotoBlock.js";
import { buildIcon } from "../../icons.js";
import { createUnsavedChangesGuard } from "../../../../../shared/js/unsavedChanges/unsavedChangesGuard.js";
import { snapshotFormValues } from "../../../../../shared/js/unsavedChanges/snapshotFormValues.js";
import { attachCierreConGuarda } from "../../../../../shared/js/unsavedChanges/attachCierreConGuarda.js";

// Drawer lateral de gastos — sin argumento, `open()` crea un gasto nuevo
// (título "Nuevo gasto", botón "Subir factura" con OCR); con un gasto
// existente, `open(gasto)` entra en modo detalle/edición (título con el
// proveedor, foto ya subida o botón para subirla, "Guardar cambios" y
// "Eliminar"). `onGuardar`/`onActualizar`/`onEliminar` reciben los datos
// ya calculados (IVA, retención, total) y deciden cómo persistirlos.
// `onGuardar(valores, archivo)` crea el gasto Y, si hay archivo, le sube la
// foto contra su id real (ver finanzasSection.js). Devuelve `avisoFoto`
// cuando el gasto se creó pero la foto no se pudo subir: el gasto ya existe,
// así que ese fallo no puede deshacer nada ni impedir cerrar — se avisa y el
// admin adjunta la foto reabriéndolo.
export function createGastoDrawer(root, { onGuardar, onActualizar, onEliminar, avisarFn = showToast }) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  function close() {
    overlay.classList.remove("open");
  }

  // Reasignado en cada render() — el guard necesita leer los campos
  // actuales, no una copia congelada de la primera apertura.
  let fieldsActuales = null;
  // El control de subida del modo NUEVO: guarda el archivo elegido hasta que
  // el gasto existe. null al editar (ahí manda buildGastoFotoBlock, que sube
  // contra un id que ya existe).
  let uploadCtl = null;

  function snapshotGastoForm() {
    return fieldsActuales ? snapshotFormValues(fieldsActuales.wrap) : [];
  }
  const guard = createUnsavedChangesGuard({ getSnapshot: snapshotGastoForm });
  const intentarCerrarAccidental = attachCierreConGuarda({ guard, cerrarFn: close });

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
        if (esNuevo) {
          const { avisoFoto } = (await onGuardar(valores, uploadCtl?.getArchivo() || null)) || {};
          if (avisoFoto) avisarFn(avisoFoto, { duracionMs: 8000 });
        } else {
          await onActualizar(gastoActual.id, valores);
        }
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

    fieldsActuales = buildGastoFormFields(gastoActual);
    const fields = fieldsActuales;
    const body = document.createElement("div");
    body.className = "ac-drawer-body";
    body.appendChild(fields.wrap);

    const msg = document.createElement("div");
    msg.className = "ac-drawer-msg";

    const foot = buildFoot({ esNuevo, gastoActual, fields, msg });

    uploadCtl = esNuevo ? buildGastoUpload({ onExtraido: (datos) => fields.rellenarDesdeOcr(datos) }) : null;
    const fotoOUpload = uploadCtl
      ? uploadCtl.wrap
      : buildGastoFotoBlock({
          fotoUrl: gastoActual.foto_url,
          gastoId: gastoActual.id,
          onFotoSubida: (url) => { gastoActual.foto_url = url; },
        });

    drawer.append(head, fotoOUpload, body, msg, foot);
    guard.marcarLimpio();
  }

  function open(gasto) {
    render(gasto || null);
    overlay.classList.add("open");
  }

  // Antes este drawer nunca se cerraba al hacer clic en el overlay, a
  // propósito, para no perder por accidente los datos ya rellenados (a mano
  // o vía OCR) de un gasto — ahora ese mismo criterio lo decide la guarda
  // de cambios sin guardar (mismo patrón que el resto del panel): si no hay
  // nada sin guardar, cierra igual que cualquier otro drawer.
  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) intentarCerrarAccidental(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && overlay.classList.contains("open")) intentarCerrarAccidental();
  });

  return { open, close };
}
