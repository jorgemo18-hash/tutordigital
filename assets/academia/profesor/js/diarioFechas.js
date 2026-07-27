// Helpers de fechas compartidos entre diario.js (navegación día a día) y
// diarioDrawer.js/diarioDrawerBody.js (qué se puede registrar en cada
// fecha) — una sola fuente para no calcular "hoy"/"futuro" dos veces con
// riesgo de que diverjan.
const DIA_MS = 24 * 60 * 60 * 1000;

// Hasta cuánto se puede retroceder: un mes natural de margen para revisar
// o completar registros atrasados.
export const RANGO_DIAS_ATRAS = 30;

// Hasta cuánto se puede avanzar para marcar una AUSENCIA anticipada (la
// familia avisa con antelación) — nunca para registrar una clase, que solo
// tiene sentido una vez ha ocurrido (ver esFechaFutura). 90 días (~un
// trimestre) cubre con margen los avisos anticipados habituales (viaje
// familiar, proceso médico programado...) sin dejarlo sin límite; no
// existe un concepto de "fin de curso" en academia_config que se pudiera
// usar en su lugar, así que se opta por un número de días fijo, igual que
// ya hace RANGO_DIAS_ATRAS.
export const RANGO_DIAS_ADELANTE = 90;

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function shiftISO(fechaISO, days) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d) + days * DIA_MS);
  return date.toISOString().slice(0, 10);
}

export function clampToRange(fechaISO, hoyISO = todayISO()) {
  const max = shiftISO(hoyISO, RANGO_DIAS_ADELANTE);
  const min = shiftISO(hoyISO, -RANGO_DIAS_ATRAS);
  if (fechaISO > max) return max;
  if (fechaISO < min) return min;
  return fechaISO;
}

// Una fecha es "futura" (estrictamente posterior a hoy) — ahí solo se
// permite marcar ausencia, nunca registrar una clase (ver
// diarioDrawerBody.js#buildClaseBody). Hoy mismo NO cuenta como futuro:
// registrar la clase de hoy sigue siendo el caso normal.
export function esFechaFutura(fechaISO, hoyISO = todayISO()) {
  return fechaISO > hoyISO;
}
