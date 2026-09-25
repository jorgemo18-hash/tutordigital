import { reuneApartados } from "../../ejercicio.js";
import { texto, latex, alAzar, dec, compara, porPotencia, entrePotencia } from "../decimales/decimal.js";
import { MAGNITUDES, convierte, alReves, unEscalonDeMenos, lugares } from "./unidades.js";
import { milesTexto } from "../potenciasRaices/formato.js";

// MEDIDA, OBJETIVOS 2 Y 4: CAMBIAR DE UNIDAD (conceptos 2 y 4). Saber B.1:
// «Estrategias de elección de las unidades y operaciones adecuadas en
// problemas que impliquen medida».
//
// LA ESCALERA: de una unidad a la siguiente más pequeña, por 10 (en
// superficie, por 100); a la más grande, entre 10. Es mover la coma, y los
// números se eligen con decimales para que haya que moverla de verdad.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   1 mover la coma al revés (3,5 km = 0,0035 m);
//   2 contar mal los escalones (3,5 km = 350 m);
//   3 en superficie, mover la coma UN lugar por escalón, como en longitud
//     (2 m² = 20 dm²).

const LINEALES = ["longitud", "masa", "capacidad"];

// Dos unidades de la misma magnitud a `pasos` escalones como mucho.
function dosUnidades(azar, magnitud, { min = 1, max = 3 } = {}) {
  const u = MAGNITUDES[magnitud].unidades;
  const i = azar.entero(0, u.length - 1);
  const j = azar.entero(0, u.length - 1);
  const pasos = Math.abs(i - j);
  if (pasos < min || pasos > max) return null;
  return [u[i], u[j]];
}

function apartadoDeCambio(azar, magnitud, rango) {
  const par = dosUnidades(azar, magnitud, rango);
  if (!par) return null;
  const [de, a] = par;
  const d = alAzar(azar, { e: azar.entero(0, 2) || 1, min: 0, max: 60 });
  if (!d) return null;
  const r = convierte(magnitud, d, de, a);
  // Que no salgan más de cuatro decimales ni números de más de siete cifras.
  if (r.e > 4 || Math.abs(r.n) >= 10 ** 7) return null;
  const k = lugares(magnitud, de, a);
  const escalones = Math.abs(k) / MAGNITUDES[magnitud].cifrasPorEscalon;
  return {
    latex: `$${latex(d)}$ ${de} = ___ ${a}`,
    latexResuelto: `$${latex(d)}$ ${de} = $${latex(r)}$ ${a}`,
    texto: `${texto(d)} ${de} = ___ ${a}`,
    solucion: texto(r),
    alReves: texto(alReves(magnitud, d, de, a)),
    escalonDeMenos: (() => { const x = unEscalonDeMenos(magnitud, d, de, a); return x ? texto(x) : null; })(),
    // Error 3 (solo superficie): un lugar por escalón, como en longitud.
    comoLongitud: MAGNITUDES[magnitud].cifrasPorEscalon === 2
      ? texto(k > 0 ? porPotencia(d, escalones) : entrePotencia(d, escalones))
      : null,
    razon: `De ${de} a ${a} hay ${escalones} ${escalones === 1 ? "escalón" : "escalones"} ${k > 0 ? "hacia abajo: se multiplica" : "hacia arriba: se divide"}`
      + ` por ${milesTexto(10 ** Math.abs(k))}${MAGNITUDES[magnitud].cifrasPorEscalon === 2 ? " (100 por escalón)" : ""}, y la coma se mueve ${Math.abs(k)} ${Math.abs(k) === 1 ? "lugar" : "lugares"}: ${texto(r)} ${a}.`,
  };
}

// ── "Cambia de unidad" (dificultad 1) ───────────────────────────────────
// De 6 a 8, de uno a tres escalones, mezclando longitud, masa y capacidad.
export function cambioDeUnidad(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const magnitud = LINEALES[i % 3];
    const ap = apartadoDeCambio(azar, magnitud, { min: 1, max: 3 });
    if (ap) i += 1;
    return ap;
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "cambio_de_unidad",
    arquetipo: "Cambia de unidad de longitud, masa o capacidad",
    enunciado: "Completa:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Cambia de unidad de superficie" (dificultad 2) ─────────────────────
// De 5 a 7, de uno a dos escalones: aquí cada escalón es por 100.
export function cambioDeSuperficie(azar, { cuantos = 5 } = {}) {
  const { apartados } = reuneApartados(() => apartadoDeCambio(azar, "superficie", { min: 1, max: 2 }),
    { cuantos, clave: (a) => a.texto });

  return {
    clave: "cambio_de_superficie",
    arquetipo: "Cambia de unidad de superficie",
    enunciado: "Completa (en superficie, cada escalón es por 100):",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}

// ── "¿Qué es más?" (dificultad 2) ───────────────────────────────────────
// De 5 a 7 parejas de la misma magnitud en unidades distintas. Casi
// siempre el número más grande es la medida MÁS PEQUEÑA (3,2 kg y 3050 g):
// comparar los números sin pasar a la misma unidad (error 5) falla.
export function comparaMedidas(azar, { cuantos = 5 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const magnitud = LINEALES[i % 3];
    const par = dosUnidades(azar, magnitud, { min: 1, max: 3 });
    if (!par) return null;
    const [grande, pequena] = MAGNITUDES[magnitud].unidades.indexOf(par[0]) < MAGNITUDES[magnitud].unidades.indexOf(par[1]) ? par : [par[1], par[0]];
    const a = alAzar(azar, { e: 1, min: 1, max: 9 });
    if (!a) return null;
    const aEnPequena = convierte(magnitud, a, grande, pequena);
    // b, en la unidad pequeña, cerca de a pero distinta: un poco por
    // debajo o por encima.
    const factor = azar.elige([0.8, 0.9, 0.95, 1.05, 1.1, 1.2]);
    const b = dec(Math.round(Number(texto(aEnPequena).replace(/ /g, "").replace(",", ".")) * factor));
    if (b.n <= 0 || compara(b, aEnPequena) === 0) return null;
    i += 1;
    const s = compara(aEnPequena, b) > 0 ? ">" : "<";
    return {
      latex: `$${latex(a)}$ ${grande} □ $${latex(b)}$ ${pequena} ___`,
      latexResuelto: `$${latex(a)}$ ${grande} ${s} $${latex(b)}$ ${pequena}`,
      texto: `${texto(a)} ${grande} □ ${texto(b)} ${pequena} ___`,
      solucion: s,
      soloNumeros: compara(a, b) > 0 ? ">" : "<",
      razon: `En la misma unidad: ${texto(a)} ${grande} = ${texto(aEnPequena)} ${pequena}, y ${texto(aEnPequena)} ${s} ${texto(b)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "compara_medidas",
    arquetipo: "Compara medidas expresadas en unidades distintas",
    enunciado: "Escribe < o > (pasa antes a la misma unidad):",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// Las medidas agrarias son las de superficie con otro nombre: la hectárea
// es el hm², el área el dam² y la centiárea el m².
const AGRARIAS = { ha: "hm²", a: "dam²", ca: "m²" };

// ── "Hectáreas y áreas" (dificultad 3) ──────────────────────────────────
// De 3 a 5: de hectáreas o áreas a m², y al revés, en contexto (fincas,
// parques). Es la superficie que aparece en la vida real.
export function medidasAgrarias(azar, { cuantos = 3 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const [agraria, deAgraria] = [azar.elige(["ha", "a"]), i % 2 === 0];
    const que = azar.elige(["Una finca", "Un parque", "Un campo de cereal", "Un olivar", "Un viñedo", "Un pinar"]);
    const d = alAzar(azar, { e: azar.entero(0, 1) || 1, min: 1, max: 40 });
    if (!d) return null;
    const enM2 = convierte("superficie", d, AGRARIAS[agraria], "m²");
    const [dato, udato, r, ur] = deAgraria ? [d, agraria, enM2, "m²"] : [enM2, "m²", d, agraria];
    if (r.e > 3) return null;
    i += 1;
    const pregunta = { ha: "¿Cuántas hectáreas son?", a: "¿Cuántas áreas son?", "m²": "¿Cuántos m² son?" }[ur];
    const frase = `${que} mide ${texto(dato)} ${udato}. ${pregunta}`;
    return {
      latex: `${frase} ___`,
      latexResuelto: `${frase} ${texto(r)} ${ur}.`,
      texto: `${frase} ___`,
      solucion: `${texto(r)} ${ur}`,
      que,
      razon: `1 ${agraria} = 1 ${AGRARIAS[agraria]} = ${agraria === "ha" ? "10 000" : "100"} m². ${deAgraria ? "Se multiplica" : "Se divide"}: ${texto(dato)} ${udato} = ${texto(r)} ${ur}.`,
    };
  }, { cuantos, clave: (a) => a.que });

  return {
    clave: "medidas_agrarias",
    arquetipo: "Pasa de hectáreas y áreas a metros cuadrados y al revés",
    enunciado: "Resuelve (1 ha = 1 hm², 1 a = 1 dam²):",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
