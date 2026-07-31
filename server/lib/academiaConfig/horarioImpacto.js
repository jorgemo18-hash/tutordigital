import { generarHoras } from "../../../assets/shared/js/horarioFranjas.js";

// Cuántas filas VIGENTES de academia_horario del tenant tienen un
// hora_inicio que NO estaría entre las horas generadas por un cambio de
// franja_inicio/franja_fin/franja_duracion — el aviso de huérfanos antes
// de guardar (decisión de producto 2026-07-31, ver docs/deuda-tecnica.md).
// Filtra por fecha_fin igual que fetchFranjasVisibles (academia.horario.
// routes.js) — antes no filtraba ninguno de los dos, y el aviso contaba
// filas ya cerradas (32 de 47 en Lyceo) como si fueran clases reales que
// se iban a perder.
export function contarHuerfanos(filas, { franjaInicio, franjaFin, franjaDuracion }) {
  const nuevasHoras = new Set(generarHoras(franjaInicio, franjaFin, franjaDuracion));
  return (filas || []).filter((f) => !nuevasHoras.has(String(f.hora_inicio || "").slice(0, 5))).length;
}

export async function fetchImpactoHorario(admin, tenantId, { franjaInicio, franjaFin, franjaDuracion }) {
  const { data, error } = await admin
    .from("academia_horario")
    .select("hora_inicio")
    .eq("tenant_id", tenantId)
    .is("fecha_fin", null);
  if (error) return { error };
  return { huerfanos: contarHuerfanos(data, { franjaInicio, franjaFin, franjaDuracion }) };
}
