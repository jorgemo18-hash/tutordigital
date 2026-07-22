import { buildRegenerarBoton } from "../regenerarBoton.js";
import { elegirAccion } from "../elegirAccionDialog.js";
import { opcionesFamilia } from "./opcionesAccion.js";
import { regenerarFamilia, enviarFamiliaAccion } from "./accionesFamilia.js";

function cancelado() {
  const err = new Error("Acción cancelada.");
  err.code = "cancelado";
  return err;
}

// Los dos botones únicos "Regenerar"/"Enviar" junto al selector Informe/
// Recibo, para la familia actualmente seleccionada — cada uno abre el
// diálogo de opciones (recibo+informes / solo recibo / solo informes / uno
// por alumno) y delega la ejecución en acciones/accionesFamilia.js.
// `onAccionFamilia` refresca la lista Y el panel (a diferencia de
// `onCambio`, que solo toca la lista) porque la acción pudo cambiar
// exactamente lo que se está viendo en el panel derecho.
export function buildAccionesFamilia(item, { mes, anio, api, onAccionFamilia, elegirAccionFn = elegirAccion }) {
  const wrap = document.createElement("div");
  wrap.className = "ef-acciones-familia";

  const msg = document.createElement("span");
  msg.className = "ac-drawer-msg";

  const regenerarBtn = buildRegenerarBoton({
    textoIdle: "Regenerar",
    textoOk: "✓ Regenerado",
    claseExtra: "copper",
    ejecutar: async () => {
      const opcion = await elegirAccionFn({ titulo: "¿Qué quieres regenerar?", opciones: opcionesFamilia("Regenerar", item.alumnos_activos) });
      if (!opcion) throw cancelado();
      const resultado = await regenerarFamilia(opcion, {
        item, mes, anio,
        regenerarReciboFn: api.regenerarRecibo,
        generarReciboFamiliaFn: api.generarReciboFamilia,
        generarInformeFn: api.generarInforme,
      });
      await onAccionFamilia?.();
      return resultado;
    },
    onError: (err) => { msg.textContent = err.message || "No se pudo regenerar."; msg.className = "ac-drawer-msg error"; },
  });

  const enviarBtn = buildRegenerarBoton({
    textoIdle: "Enviar",
    textoCargando: "Enviando…",
    textoOk: "✓ Enviado",
    claseExtra: "primary",
    ejecutar: async () => {
      const opcion = await elegirAccionFn({ titulo: "¿Qué quieres enviar?", opciones: opcionesFamilia("Enviar", item.alumnos_activos) });
      if (!opcion) throw cancelado();
      const resultado = await enviarFamiliaAccion(opcion, {
        item, mes, anio,
        enviarFamiliaFn: api.enviarFamilia,
        enviarInformeFn: api.enviarInforme,
      });
      await onAccionFamilia?.();
      return resultado;
    },
    onError: (err) => { msg.textContent = err.message || "No se pudo enviar."; msg.className = "ac-drawer-msg error"; },
  });

  wrap.append(regenerarBtn, enviarBtn, msg);
  return wrap;
}
