// LO QUE EL VERIFICADOR NO PUEDE VER Y SÍ SE PUEDE DETECTAR CON REGLAS.
//
// Segunda prueba real (1/10/2026): un problema salió «COMPROBADA» siendo
// imprimible solo para tirarlo. La IA se corrigió dentro del enunciado («En
// realidad, simplifica: …») y la respuesta era x = 0 (ninguna entrada a
// precio completo). La ecuación cuadraba; el problema no tenía sentido.
// El código no entiende un enunciado, pero estas dos señales sí las ve:
//   1. la IA pensando en voz alta dentro del enunciado;
//   2. un problema cuya respuesta es 0 (en la ESO, un problema de contar,
//      repartir o calcular edades o precios no se resuelve con «ninguno»).
// No es un filtro completo: el profesor tiene que leer los problemas (por
// eso generaHojaIA los marca «revisar el enunciado»).
const PENSAR_EN_VOZ_ALTA = [
  /\ben realidad\b/i,
  /\bmejor dicho\b/i,
  /\bcorrijo\b/i,
  /\bcorrecci[oó]n\s*:/i,
  /\bperd[oó]n\b/i,
  /\bme he equivocado\b/i,
  /\bespera\b\s*[,:]/i,
  /\bsimplifica\s*:/i,
  /\breplanteemos\b|\breplanteo\b/i,
  /\bmejor (?:lo )?cambi/i,
  /\bnota para el profesor\b/i,
];

export function seCorrigeDentro(texto) {
  return PENSAR_EN_VOZ_ALTA.some((r) => r.test(String(texto || "")));
}

const esCero = (v) => /^\s*-?0+(?:[.,]0+)?\s*$/.test(String(v));

// ¿Todas las respuestas del planteamiento son 0?
export function respuestaTrivial(comprobar = []) {
  const valores = comprobar.flatMap((c) => {
    const r = c.respuesta;
    if (Array.isArray(r)) return r;
    if (r && typeof r === "object") return Object.values(r);
    return typeof r === "string" || typeof r === "number" ? [r] : [];
  });
  return valores.length > 0 && valores.every(esCero);
}
