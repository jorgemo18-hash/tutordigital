import { generarHoras } from "../../../assets/shared/js/horarioFranjas.js";

// Cuántas filas de academia_horario del tenant tienen un hora_inicio que
// NO estaría entre las horas generadas por un cambio de franja_inicio/
// franja_fin/franja_duracion — el aviso de huérfanos antes de guardar
// (decisión de producto 2026-07-31, ver docs/deuda-tecnica.md). Cuenta
// TODAS las filas, sin filtrar por fecha_fin: la consulta real del
// horario (academia.horario.routes.js) tampoco filtra por fecha_fin hoy,
// así que "dejarían de aparecer en el horario" tiene que usar el mismo
// criterio que lo que de verdad se muestra, no uno más estricto que dé
// una cifra optimista.
export function contarHuerfanos(filas, { franjaInicio, franjaFin, franjaDuracion }) {
  const nuevasHoras = new Set(generarHoras(franjaInicio, franjaFin, franjaDuracion));
  return (filas || []).filter((f) => !nuevasHoras.has(String(f.hora_inicio || "").slice(0, 5))).length;
}

export async function fetchImpactoHorario(admin, tenantId, { franjaInicio, franjaFin, franjaDuracion }) {
  const { data, error } = await admin
    .from("academia_horario")
    .select("hora_inicio")
    .eq("tenant_id", tenantId);
  if (error) return { error };
  return { huerfanos: contarHuerfanos(data, { franjaInicio, franjaFin, franjaDuracion }) };
}
