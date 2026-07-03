const MESES_CORTOS = [null, "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatFechaCorta(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MESES_CORTOS[d.getMonth() + 1]}`;
}

// Qué le falta enviar a una familia este mes: el recibo (si existe y no
// está enviado) y el informe de cada alumno con sesiones (si no está
// enviado) — usado tanto para el estado agregado de abajo como para
// "Enviar a todos" (ver envioFamiliasSection.js).
export function pendientesDeFamilia(item) {
  const alumnosConSesiones = item.alumnos_activos.filter((a) => a.tiene_sesiones);
  return {
    reciboPendiente: Boolean(item.recibo) && item.recibo.estado !== "enviado",
    alumnosInformePendientes: alumnosConSesiones.filter((a) => !a.informe_enviado_at),
    alumnosConSesiones,
  };
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

  const { reciboPendiente, alumnosInformePendientes, alumnosConSesiones } = pendientesDeFamilia(item);
  const reciboAplica = Boolean(item.recibo);
  const informesAplican = alumnosConSesiones.length > 0;

  if (!reciboAplica && !informesAplican) return { tipo: "vacio", texto: "Sin recibo ni informe este mes" };
  if (reciboPendiente || alumnosInformePendientes.length) return { tipo: "pendiente", texto: "Pendiente" };

  const fechas = [item.recibo?.fecha_envio, ...alumnosConSesiones.map((a) => a.informe_enviado_at)].filter(Boolean).sort();
  const masReciente = fechas[fechas.length - 1];
  return { tipo: "enviado", texto: masReciente ? `Enviado el ${formatFechaCorta(masReciente)}` : "Enviado" };
}

export function claseDotEstado(tipo) {
  const clases = {
    pendiente: "ef-dot--pendiente",
    enviado: "ef-dot--enviado",
    error: "ef-dot--error",
    sin_email: "ef-dot--sin-recibo",
    vacio: "ef-dot--sin-recibo",
  };
  return clases[tipo] || "ef-dot--sin-recibo";
}
