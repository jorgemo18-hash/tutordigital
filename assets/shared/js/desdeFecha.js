// "desde 6/10": la marca de un alumno que tiene horario pero todavía no ha
// empezado a venir.
//
// POR QUÉ SE COMPARTE (11/09/2026). La lógica vivía dentro de
// `buildBadgeDesde` en el cuadrante del profesor. El del admin
// (rejillaCentro.js) no marcaba nada, así que en la pantalla donde se
// reparten las plazas un alumno de octubre se veía exactamente igual que uno
// que ya viene — y es ahí donde se decide si cabe alguien más.
//
// Decisión de Jorge: en el cuadrante SALEN (la plaza está comprometida) pero
// "marcados de alguna manera"; en el Diario no salen.
//
// AQUÍ SOLO EL TEXTO Y EL MOTIVO, no el elemento: los dos cuadrantes tienen
// su propio CSS (`ac-` el del profesor, `ach-` el del admin) y compartir la
// pastilla obligaría a pasar el nombre de la clase como parámetro, que es
// repartir el estilo entre dos sitios para ahorrar tres líneas de DOM.
//
// La comparación es de cadenas YMD, NUNCA `Date`: construir un Date en el
// navegador arrastra la zona horaria y el 1 de octubre a medianoche pasa a
// ser el 30 de septiembre. Mismo criterio que aniosArchivo.js.

export function hoyYMD() {
  return new Date().toISOString().slice(0, 10);
}

// "desde 6/10", o "" para las que ya cuentan —que son casi todas—. Una marca
// en cada alumno no marcaría nada.
export function textoDesde(fechaInicio, hoyISO = hoyYMD()) {
  const desde = String(fechaInicio || "").slice(0, 10);
  if (!desde || desde <= hoyISO) return "";
  const [, mes, dia] = desde.split("-");
  return `desde ${Number(dia)}/${Number(mes)}`;
}

// El título, que es donde cabe la consecuencia entera. La pastilla dice
// CUÁNDO; esto dice qué significa, que es lo que no se adivina: que el
// alumno no está en el Diario todavía.
export function tituloDesde(fechaInicio) {
  const desde = String(fechaInicio || "").slice(0, 10);
  if (!desde) return "";
  const [anio, mes, dia] = desde.split("-");
  return `Este alumno empieza el ${dia}/${mes}/${anio}: todavía no aparece en el Diario`;
}
