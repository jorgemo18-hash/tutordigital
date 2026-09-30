import { confirmarYEjecutar } from "../confirmarYEjecutar.js";
import { alumnosDelInforme } from "../alumnosDelInforme.js";

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function mensajeConfirmacionRecibo({ estado, fecha_envio }) {
  const accion = estado === "pagado" ? "marcó como pagado" : "envió a la familia";
  return `Este recibo ya se ${accion} el ${formatFecha(fecha_envio)}. Regenerarlo creará una versión distinta a la que recibieron. ¿Continuar?`;
}

function mensajeConfirmacionInformeRegenerar({ enviado_at }, nombre) {
  return `El informe de ${nombre} ya se envió a la familia el ${formatFecha(enviado_at)}. Regenerarlo creará una versión distinta a la que recibieron. ¿Continuar?`;
}

function mensajeConfirmacionInformeEnviar({ enviado_at }, nombre) {
  return `El informe de ${nombre} ya se envió a la familia el ${formatFecha(enviado_at)}. ¿Reenviarlo de todos modos?`;
}

function mensajeConfirmacionEnvioFamilia({ afectados }) {
  return `${afectados} documento(s) de este envío ya están enviados o pagados. ¿Continuar de todos modos?`;
}

// Regenera el recibo de la familia (si existe; si no, lo genera — mismo
// fallback que ya tenía "Generar recibo" en la tab Recibo) y/o el informe
// de cada alumno activo, según el `tipo` de la opción elegida en el
// diálogo. "informe_alumno" es la opción por un único alumno concreto —
// nunca pasa por el recibo. Cada llamada tiene su propio ciclo de
// confirmación forward-only, independiente de las demás (si "completo"
// afecta a varios documentos, se preguntan uno a uno, nunca en un único
// diálogo combinado).
// `periodoInforme`: el mes de los informes, que puede no ser el del recibo
// (ver assets/shared/js/periodosDeEnvio.js). Sin él, el mismo.
export async function regenerarFamilia(opcion, {
  item, mes, anio, periodoInforme = { mes, anio },
  regenerarReciboFn, generarReciboFamiliaFn, generarInformeFn,
  confirmFn,
}) {
  const resultado = { recibo: null, informes: [] };

  if (opcion.tipo === "informe_alumno") {
    resultado.informes.push(
      await confirmarYEjecutar(
        (confirmar) => generarInformeFn({ alumno_id: opcion.alumnoId, ...periodoInforme, forzar: true, confirmar }),
        { mensajeConfirmacion: (details) => mensajeConfirmacionInformeRegenerar(details, opcion.alumnoNombre), confirmFn }
      )
    );
    return resultado;
  }

  if (opcion.tipo !== "solo_informe") {
    resultado.recibo = item.recibo
      ? await confirmarYEjecutar(
          (confirmar) => regenerarReciboFn(item.recibo.id, confirmar),
          { mensajeConfirmacion: mensajeConfirmacionRecibo, confirmFn }
        )
      : await generarReciboFamiliaFn({ familia_id: item.familia_id, mes, anio });
  }

  if (opcion.tipo !== "solo_recibo") {
    for (const alumno of alumnosDelInforme(item)) {
      resultado.informes.push(
        await confirmarYEjecutar(
          (confirmar) => generarInformeFn({ alumno_id: alumno.id, ...periodoInforme, forzar: true, confirmar }),
          { mensajeConfirmacion: (details) => mensajeConfirmacionInformeRegenerar(details, alumno.nombre), confirmFn }
        )
      );
    }
  }

  return resultado;
}

// Envía el paquete elegido a la familia (un único email, ver
// enviarReciboYInformesDeFamilia — la confirmación agregada ya la calcula
// el backend en una sola llamada) o el informe de un único alumno
// ("informe_alumno", email aparte, sin recibo).
export async function enviarFamiliaAccion(opcion, {
  item, mes, anio, periodoInforme = { mes, anio },
  enviarFamiliaFn, enviarInformeFn,
  confirmFn,
}) {
  if (opcion.tipo === "informe_alumno") {
    return confirmarYEjecutar(
      (confirmar) => enviarInformeFn({ alumno_id: opcion.alumnoId, ...periodoInforme, confirmar }),
      { mensajeConfirmacion: (details) => mensajeConfirmacionInformeEnviar(details, opcion.alumnoNombre), confirmFn }
    );
  }

  return confirmarYEjecutar(
    (confirmar) => enviarFamiliaFn({ familia_id: item.familia_id, mes, anio, tipo: opcion.tipo, confirmar }),
    { mensajeConfirmacion: mensajeConfirmacionEnvioFamilia, confirmFn }
  );
}
