import { codigoDeHoja } from "../../../assets/shared/hoja/js/codigoHoja.js";

// EL CÓDIGO QUE TOCA HOY A UNA HOJA NUEVA: H-AAMMDD-NN, con NN el siguiente
// del día EN ESE CENTRO (el formato está en assets/shared/hoja/js/codigoHoja.js).
//
// "Hoy" es el día de España, no el del servidor: Render corre en UTC y una
// hoja impresa a las 00:30 del 24 saldría con fecha del 23.
export const ZONA = "Europe/Madrid";

export function diaEnEspana(ahora = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(ahora)
      .map((p) => [p.type, p.value]),
  );
  // Una fecha "local" con esos números: es lo que espera codigoDeHoja.
  return new Date(Number(partes.year), Number(partes.month) - 1, Number(partes.day));
}

// El prefijo del día ("H-260923-") y el código siguiente a los que ya hay.
export function prefijoDelDia(ahora = new Date()) {
  return codigoDeHoja({ fecha: diaEnEspana(ahora), secuencia: 0 }).replace(/\d+$/, "");
}

export function siguienteCodigo(codigosDeHoy, ahora = new Date()) {
  const prefijo = prefijoDelDia(ahora);
  const usados = codigosDeHoy
    .filter((c) => typeof c === "string" && c.startsWith(prefijo))
    .map((c) => Number(c.slice(prefijo.length)))
    .filter(Number.isFinite);
  const siguiente = (usados.length ? Math.max(...usados) : 0) + 1;
  return codigoDeHoja({ fecha: diaEnEspana(ahora), secuencia: siguiente });
}
