import { reuneApartados } from "../../ejercicio.js";
import {
  factoriza, desdeFactores, cuantosFactores, divisionesSucesivas, factoresLatex, factoresTexto, superindice,
} from "./aritmetica.js";
import { PRIMOS_PEQUENOS, HUECO_LARGO } from "./numeros.js";

// DIVISIBILIDAD, OBJETIVO 4: DESCOMPONER EN FACTORES PRIMOS (concepto 5).
//
// La descomposición se escribe CON POTENCIAS (2³ · 3² · 5), que es como la
// piden todos los materiales y como la necesitan después el m.c.d. y el
// m.c.m. La solución guardada es ese texto; la respuesta-trampa del error de
// las potencias (2³ = 6) sale de recalcular con esa creencia.


// Un número que merece descomponerse: al menos tres factores contando los
// repetidos, alguno repetido (si no, no hay potencia que escribir), y sin
// primos grandes (dividir entre 17 no se hace de cabeza en 1.º).
function merece(n) {
  const f = factoriza(n);
  return cuantosFactores(n) >= 3
    && f.some(([, e]) => e >= 2)
    && f.every(([p]) => PRIMOS_PEQUENOS.includes(p));
}

function razonDescomposicion(n) {
  const pasos = divisionesSucesivas(n).map((d) => `${d.dividendo} : ${d.primo} = ${d.cociente}`);
  return `${pasos.join("; ")}. Se agrupan los repetidos: ${factoresTexto(factoriza(n))}.`;
}

// ── "Descompón en factores primos" (dificultad 1) ───────────────────────
// De 4 a 6 números de 12 a 600.
export function descomponEnFactores(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const n = azar.entero(12, 600);
    if (!merece(n)) return null;
    const factores = factoriza(n);
    return {
      latex: `$${n} =$ ${HUECO_LARGO}`,
      latexResuelto: `$${n} = ${factoresLatex(factores)}$`,
      texto: `${n} = ___`,
      solucion: factoresTexto(factores),
      numero: n,
      razon: razonDescomposicion(n),
    };
  }, { cuantos, intentos: 600, clave: (a) => String(a.numero) });

  return {
    clave: "descompon_en_factores",
    arquetipo: "Descompón en factores primos",
    enunciado: "Descompón en factores primos y escribe el resultado con potencias:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// Unos factores al azar: 2 o 3 primos distintos, exponentes de 1 a 3, y al
// menos un exponente mayor que 1.
function factoresAlAzar(azar, { tope }) {
  const cuantosPrimos = azar.entero(2, 3);
  const primos = azar.mezcla(PRIMOS_PEQUENOS.slice(0, 5)).slice(0, cuantosPrimos).sort((a, b) => a - b);
  const factores = primos.map((p) => [p, p > 5 ? 1 : azar.entero(1, 3)]);
  if (!factores.some(([, e]) => e > 1)) return null;
  return desdeFactores(factores) <= tope ? factores : null;
}

// ── "¿Qué número es?" (dificultad 1) ─────────────────────────────────────
// De 4 a 6: la operación inversa de descomponer (A.3 pide expresamente las
// relaciones inversas). Resultados hasta 1000.
export function numeroDesdeFactores(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const factores = factoresAlAzar(azar, { tope: 1000 });
    if (!factores) return null;
    const solucion = desdeFactores(factores);
    const potencias = factores.filter(([, e]) => e > 1).map(([p, e]) => `${p}${superindice(e)} = ${p ** e}`);
    const valores = factores.map(([p, e]) => p ** e).join(" · ");
    return {
      latex: `$${factoresLatex(factores)} =$ ___`,
      latexResuelto: `$${factoresLatex(factores)} = ${solucion}$`,
      texto: `${factoresTexto(factores)} = ___`,
      solucion,
      factores,
      razon: `Primero las potencias: ${potencias.join("; ")}. Después, ${valores} = ${solucion}.`,
    };
  }, { cuantos, clave: (a) => String(a.solucion) });

  return {
    clave: "numero_desde_factores",
    arquetipo: "Escribe el número que tiene esta descomposición",
    enunciado: "¿Qué número es? Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "¿Es divisor? Míralo en los factores" (dificultad 3) ─────────────────
//
// De 3 a 4. Se dan los dos números YA DESCOMPUESTOS y se pregunta si uno
// divide al otro sin calcularlos: a divide a b si cada factor de a está en b
// con un exponente igual o mayor. Es el razonamiento que sostiene el m.c.d.,
// y por eso es la batería difícil del objetivo.
//
// Los "no" son de dos tipos, y los dos tienen que salir: un exponente que se
// pasa, y un primo que no está.
function divisorPropuesto(azar, grande, tipo) {
  const partes = grande.map(([p, e]) => [p, azar.entero(0, e)]).filter(([, e]) => e > 0);
  if (!partes.length) partes.push([...grande[0]]);
  if (tipo === "exponente") {
    const k = azar.entero(0, partes.length - 1);
    const [p] = partes[k];
    partes[k] = [p, grande.find(([q]) => q === p)[1] + 1];
  }
  if (tipo === "primo") {
    const fuera = PRIMOS_PEQUENOS.find((p) => !grande.some(([q]) => q === p));
    partes.push([fuera, 1]);
    partes.sort((x, y) => x[0] - y[0]);
  }
  return partes;
}

function razonDivisor(chico, grande) {
  const exponenteDe = (p) => grande.find(([q]) => q === p)?.[1] || 0;
  const falla = chico.find(([p, e]) => exponenteDe(p) < e);
  if (!falla) {
    return `Cada factor de ${factoresTexto(chico)} está en ${factoresTexto(grande)} con un exponente igual o mayor. Sí.`;
  }
  const [p, e] = falla;
  const potencia = `${p}${e > 1 ? superindice(e) : ""}`;
  return exponenteDe(p) === 0
    ? `El ${p} no está en ${factoresTexto(grande)}. No.`
    : `${potencia} no cabe en ${p}${exponenteDe(p) > 1 ? superindice(exponenteDe(p)) : ""}: el exponente es mayor. No.`;
}

export function esDivisorPorFactores(azar, { cuantos = 3 } = {}) {
  const tipos = azar.mezcla(["si", "exponente", "primo", "si"]);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const tipo = tipos[i % tipos.length];
    i += 1;
    const grande = factoresAlAzar(azar, { tope: 5000 });
    if (!grande) return null;
    const chico = divisorPropuesto(azar, grande, tipo);
    if (desdeFactores(chico) === desdeFactores(grande)) return null;
    const solucion = desdeFactores(grande) % desdeFactores(chico) === 0 ? "sí" : "no";
    const frase = `¿Es $${factoresLatex(chico)}$ divisor de $${factoresLatex(grande)}$?`;
    return {
      latex: `${frase} ___`,
      latexResuelto: `${frase} ${solucion === "sí" ? "Sí" : "No"}`,
      texto: `¿Es ${factoresTexto(chico)} divisor de ${factoresTexto(grande)}? ___`,
      solucion,
      razon: razonDivisor(chico, grande),
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "es_divisor_por_factores",
    arquetipo: "Decide si es divisor mirando la descomposición",
    enunciado: "Sin calcular los números, contesta sí o no:",
    tipo: "ejercicio",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
