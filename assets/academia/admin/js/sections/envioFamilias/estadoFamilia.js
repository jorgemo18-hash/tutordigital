import { esProblemaDeEntrega } from "../../../../../shared/js/estadosEntrega.js";

const MESES_CORTOS = [null, "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatFechaCorta(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MESES_CORTOS[d.getMonth() + 1]}`;
}

// Qué le falta enviar a una familia este mes: el recibo (si existe y no se
// ha enviado) y el informe de cada alumno con sesiones (si no está
// enviado) — usado tanto para el estado agregado de abajo como para
// "Enviar a todos" (ver envioFamiliasSection.js).
//
// SE MIRA fecha_envio, NO EL ESTADO (auditoría del 08/09/2026). Antes era
// `estado !== "enviado"`, y un recibo COBRADO queda en "pagado", no en
// "enviado" (enviar no puede deshacer un cobro, ver estadoEnvio.js). Así que
// el flujo normal —generar, enviar, cobrar— devolvía a la familia a
// "Pendiente" dos semanas después de haberle mandado el email; y si además
// le quedaba algún informe, "Enviar a todos" chocaba con la política de no
// reenviar y la familia acababa en rojo con el informe sin salir.
//
// Y NO VALE arreglarlo tratando "pagado" como enviado: un recibo se puede
// marcar como cobrado sin haberlo mandado nunca (pago en mano; ver
// marcarPago.js, que calcula `yaEnviado` justamente así). Con esa regla, esa
// familia desaparecería de la lista y no recibiría su recibo jamás.
// `fecha_envio` es el único dato que dice si el email salió — es lo que ya
// usa marcarPago.js para decidir el estado al desmarcar un cobro.
export function pendientesDeFamilia(item) {
  const alumnosConSesiones = item.alumnos_activos.filter((a) => a.tiene_sesiones);
  return {
    reciboPendiente: Boolean(item.recibo) && !item.recibo.fecha_envio,
    alumnosInformePendientes: alumnosConSesiones.filter((a) => !a.informe_enviado_at),
    alumnosConSesiones,
  };
}

// El texto que se lee en la fila. Lleva el motivo del proveedor recortado
// cuando lo hay: "no llegó" no dice qué hacer, "la dirección no existe" sí.
// El motivo completo va en el title de la fila (ver familiasLista.js).
const MOTIVO_EN_LA_FILA = 42;

function textoNoLlego({ motivo } = {}) {
  const limpio = String(motivo || "").trim();
  if (!limpio) return "No llegó";
  const corto = limpio.length > MOTIVO_EN_LA_FILA ? `${limpio.slice(0, MOTIVO_EN_LA_FILA - 1)}…` : limpio;
  return `No llegó · ${corto}`;
}

// Estado agregado de una familia para el mes seleccionado: combina el
// recibo (nivel familia) y los informes de cada alumno con sesiones (nivel
// alumno) en un único punto+texto para la lista. "Error" es un estado
// transitorio de esta sesión del navegador (no se persiste en BD, ver
// familiasConError en envioFamiliasSection.js) — gana a cualquier otro
// cálculo salvo la falta de email, que impide enviar cualquier cosa.
export function calcularEstadoFamilia(item, { tieneError = false } = {}) {
  if (!item.familia_email) return { tipo: "sin_email", texto: "Sin email registrado" };
  if (tieneError) return { tipo: "error", texto: "Error al enviar" };

  // EL ÚLTIMO EMAIL NO LLEGÓ, y eso gana a "Enviado" Y a "Pendiente".
  //
  // A "Enviado" porque decir "Enviado el 17 sep" de un email que rebotó es
  // exactamente la mentira que este trabajo venía a quitar: la app decía
  // que sí y la familia no había recibido nada.
  //
  // Y a "Pendiente" porque si la dirección no existe, volver a darle a
  // Enviar no arregla nada — rebotará igual. Lo primero es corregir el
  // email, y para eso hay que verlo. Ver server/lib/academiaEnvio/
  // consultasEnvios.js para por qué se mira el último envío y no el del mes.
  const entrega = item.envio_email;
  if (entrega && esProblemaDeEntrega(entrega.estado)) {
    return { tipo: "no_llego", texto: textoNoLlego(entrega), motivo: entrega.motivo || null };
  }

  const { reciboPendiente, alumnosInformePendientes, alumnosConSesiones } = pendientesDeFamilia(item);
  const reciboAplica = Boolean(item.recibo);
  const informesAplican = alumnosConSesiones.length > 0;

  if (!reciboAplica && !informesAplican) return { tipo: "vacio", texto: "Sin recibo ni informe este mes" };
  if (reciboPendiente || alumnosInformePendientes.length) return { tipo: "pendiente", texto: "Pendiente" };

  const fechas = [item.recibo?.fecha_envio, ...alumnosConSesiones.map((a) => a.informe_enviado_at)].filter(Boolean).sort();
  const masReciente = fechas[fechas.length - 1];
  return { tipo: "enviado", texto: masReciente ? `Enviado el ${formatFechaCorta(masReciente)}` : "Enviado" };
}

// Si una familia debe incluirse en el lote de "Enviar todos" para el tipo
// elegido en el diálogo — "solo_recibo" no debe arrastrar familias que
// solo tengan informes pendientes (y viceversa), a diferencia de
// "completo" que cubre cualquiera de los dos.
export function familiaPendienteParaTipo(item, tipo) {
  const { reciboPendiente, alumnosInformePendientes } = pendientesDeFamilia(item);
  if (tipo === "solo_recibo") return reciboPendiente;
  if (tipo === "solo_informe") return alumnosInformePendientes.length > 0;
  return reciboPendiente || alumnosInformePendientes.length > 0;
}

export function claseDotEstado(tipo) {
  const clases = {
    no_llego: "ef-dot--no-llego",
    pendiente: "ef-dot--pendiente",
    enviado: "ef-dot--enviado",
    error: "ef-dot--error",
    sin_email: "ef-dot--sin-recibo",
    vacio: "ef-dot--sin-recibo",
  };
  return clases[tipo] || "ef-dot--sin-recibo";
}
