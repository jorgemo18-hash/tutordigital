// Cálculo de tramos horarios uniformes a partir de los 3 escalares de
// academia_config (franja_inicio/franja_fin/franja_duracion) — decisión de
// producto 2026-07-31: un solo modelo de escalares, no una tabla de
// franjas irregulares (verificado contra producción: ningún tenant tiene
// hoy un tramo de duración mixta ni un hueco). Compartido entre el grid
// del profesor (academia/profesor/js/horario.js), el drawer de asignación
// del admin (academia/admin/js/drawer/horarioSection.js) y el cálculo de
// impacto del backend (academia.config.routes.js) — antes estaba
// duplicado literalmente en los dos primeros ("son bundles distintos" ya
// no es una razón válida: es JS puro sin DOM, mismo criterio ya probado
// en producción con assets/shared/js/escHtml.js).
export function toMinutos(hhmm) {
  const [h, m] = String(hhmm || "").slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function toHHMM(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function generarHoras(franjaInicio, franjaFin, franjaDuracion) {
  const inicio = toMinutos(franjaInicio);
  const fin = toMinutos(franjaFin);
  const duracion = Number(franjaDuracion) || 60;
  const horas = [];
  for (let t = inicio; t < fin; t += duracion) horas.push(toHHMM(t));
  return horas;
}
