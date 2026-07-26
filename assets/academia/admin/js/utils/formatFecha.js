// fecha_inicio/fecha_fin (y otras columnas *_at de solo fecha) llegan como
// "YYYY-MM-DD" sin componente horario. Un new Date("YYYY-MM-DD") lo
// interpreta como medianoche UTC — al mostrarlo con .toLocaleDateString()
// en un huso con offset negativo respecto a UTC, el día visible puede
// quedar uno por detrás. Por eso aquí NO se usa Date en ningún momento:
// solo se reordenan los trozos del string ya validado (regex FECHA_RE en
// el backend garantiza el formato).
export function formatFechaEs(fechaISO) {
  const [anio, mes, dia] = String(fechaISO || "").split("-");
  if (!anio || !mes || !dia) return "";
  return `${dia}/${mes}/${anio}`;
}

export function formatRangoFechasEs(fechaInicio, fechaFin) {
  const inicio = formatFechaEs(fechaInicio);
  const fin = formatFechaEs(fechaFin);
  if (!inicio || !fin) return inicio || fin;
  return inicio === fin ? inicio : `${inicio} – ${fin}`;
}
