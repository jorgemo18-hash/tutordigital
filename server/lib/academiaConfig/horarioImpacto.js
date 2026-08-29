import { filasDeRejillaDeConfig, tramosDe } from "../../../assets/shared/js/horarioTramos.js";

// Cuántas clases VIGENTES de academia_horario dejarían de caber en la
// rejilla si se cambia el horario de apertura del centro — el aviso de
// huérfanos antes de guardar (decisión de producto 2026-07-31, ver
// docs/deuda-tecnica.md). Filtra por fecha_fin igual que
// fetchFranjasVisibles (academia.horario.routes.js): antes no lo hacía y el
// aviso contaba filas ya cerradas (32 de 47 en Lyceo) como si fueran clases
// que se iban a perder.
//
// Se mira la clase ENTERA, no solo su hora de inicio: desde que una clase
// puede durar lo que sea (ver horarioTramos.js), adelantar el cierre a las
// 19:00 deja fuera media clase de 18:30 a 19:30 — y media clase fuera de la
// rejilla es una clase que el admin ya no puede ver ni tocar.
//
// `franjaDuracion` ya no entra: no dibuja las filas, solo dice cuántas
// casillas marca un clic. Cambiarla no descoloca ninguna clase existente.
export function contarHuerfanos(filas, config) {
  // Config entera (los dos tramos de apertura, migración 111): con jornada
  // partida, lo que deja fuera a una clase puede ser el hueco del mediodía,
  // no solo la apertura o el cierre.
  const rejilla = new Set(filasDeRejillaDeConfig(config));
  return (filas || []).filter((f) => {
    const tramos = tramosDe(String(f.hora_inicio || "").slice(0, 5), String(f.hora_fin || "").slice(0, 5));
    return tramos.some((t) => !rejilla.has(t));
  }).length;
}

export async function fetchImpactoHorario(admin, tenantId, config) {
  const { data, error } = await admin
    .from("academia_horario")
    .select("hora_inicio, hora_fin")
    .eq("tenant_id", tenantId)
    .is("fecha_fin", null);
  if (error) return { error };
  return { huerfanos: contarHuerfanos(data, config) };
}
