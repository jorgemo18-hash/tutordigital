import { reuneApartados } from "../../ejercicio.js";
import { mcd } from "../fracciones/fraccion.js";
import { conComa, decimalDePorcentaje } from "./numeros.js";

// PROPORCIONALIDAD, OBJETIVO 3: PORCENTAJES (conceptos 5 y 6). Saberes
// A.5 «Porcentajes: comprensión y resolución de problemas» y A.2
// «Porcentajes mayores que 100 y menores que 1: interpretación».
//
// SIN CALCULADORA: los porcentajes son los que se calculan de cabeza o con
// una cuenta corta (10, 20, 25, 50, 75, 5…), y las cantidades se eligen
// para que el resultado sea entero.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   4 calcular el porcentaje DIVIDIENDO entre él (20 % de 80 → 80 : 20 = 4);
//   5 pasar a decimal moviendo la coma un lugar (5 % → 0,5; 25 % → 2,5);
//   6 en "qué porcentaje es", quedarse en el cociente (12 de 60 → 0,2);
//   7 en "el total a partir de la parte", calcular el porcentaje DE LA PARTE
//     (el 30 % de un número es 12 → 30 % de 12 = 3,6).

const CORRIENTES = [10, 20, 25, 50, 75, 5, 30, 40, 60, 15];

// La cantidad más pequeña de la que el p % es entero: 100 / mcd(p, 100).
const paso = (p) => 100 / mcd(p, 100);

// Una cantidad de la que el p % es entero, entre 10 y 400 y siempre
// múltiplo de 10 (o de 20): "el 200 % de 359" es una cuenta que nadie
// pondría en un examen de 1.º.
function cantidadPara(azar, p) {
  const b = paso(p);
  const s = (b * 10) / mcd(b, 10);
  const m = azar.entero(Math.max(1, Math.ceil(40 / s)), Math.max(2, Math.floor(400 / s)));
  return s * m;
}

// Cómo se calcula de cabeza, cuando hay un atajo; si no, la cuenta.
function comoSeCalcula(p, q) {
  const r = (p * q) / 100;
  const atajos = {
    10: `el 10 % es dividir entre 10: ${q} : 10 = ${r}`,
    50: `el 50 % es la mitad: ${q} : 2 = ${r}`,
    25: `el 25 % es la cuarta parte: ${q} : 4 = ${r}`,
    75: `el 75 % son tres cuartas partes: ${q} : 4 = ${q / 4}, y ${q / 4} · 3 = ${r}`,
    5: `el 5 % es la mitad del 10 %: ${q} : 10 = ${q / 10}, y la mitad, ${r}`,
    200: `el 200 % es el doble: ${q} · 2 = ${r}`,
    150: `el 150 % es el total y la mitad: ${q} + ${q / 2} = ${r}`,
  };
  return atajos[p] || `${q} · ${p} : 100 = ${r}`;
}

// ── "Escribe el porcentaje como fracción y como decimal" (dificultad 1) ─
// De 5 a 7, con uno MAYOR QUE 100 y uno MENOR QUE 1 siempre (A.2 los
// nombra: "interpretación"), y el resto de los corrientes.
// Los mayores que 100 no son enteros (200 % = 2/1 no se escribe así): su
// fracción dice algo, 3/2 es "una vez y media".
const RAROS = { mayores: [150, 120, 250, 125], menores: [0.5] };

function comoFraccion(p) {
  // p puede ser 0,5: se trabaja en milésimas para seguir con enteros.
  const n = Math.round(p * 10);
  const g = mcd(n, 1000);
  return `${n / g}/${1000 / g}`;
}

export function porcentajeFraccionDecimal(azar, { cuantos = 5 } = {}) {
  const plan = [azar.elige(RAROS.mayores), azar.elige(RAROS.menores), ...azar.mezcla(CORRIENTES)];
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const p = plan[i];
    i += 1;
    if (p === undefined) return null;
    const f = comoFraccion(p);
    const d = decimalDePorcentaje(p);
    const pT = conComa(p);
    const sentido = p > 100 ? ` Más del 100 %: más que el total (${f.replace("/", " de cada ")}).`
      : p < 1 ? " Menos del 1 %: menos de 1 de cada 100 (5 de cada 1000)." : "";
    return {
      latex: `${pT} % = ___ (fracción) = ___ (decimal)`,
      latexResuelto: `${pT} % = ${f} = ${d}`,
      texto: `${pT} % = ___ (fracción) = ___ (decimal)`,
      solucion: [f, d],
      p,
      razon: `${pT} % es ${pT}/100, que simplificada es ${f}; y ${pT} : 100 = ${d} (la coma, dos lugares a la izquierda).${sentido}`,
    };
  }, { cuantos, clave: (a) => String(a.p) });

  return {
    clave: "porcentaje_fraccion_decimal",
    arquetipo: "Escribe el porcentaje como fracción y como decimal",
    enunciado: "Escribe cada porcentaje como fracción irreducible y como número decimal:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// ── "Calcula el porcentaje de una cantidad" (dificultad 1) ──────────────
export function porcentajeDeCantidad(azar, { cuantos = 6 } = {}) {
  const lista = [...CORRIENTES, 150, 200];
  const { apartados } = reuneApartados(() => {
    const p = azar.elige(lista);
    const q = cantidadPara(azar, p);
    const r = (p * q) / 100;
    return {
      latex: `${p} % de ${q} = ___`,
      latexResuelto: `${p} % de ${q} = ${r}`,
      texto: `${p} % de ${q} = ___`,
      solucion: r,
      p, q,
      razon: `${comoSeCalcula(p, q).replace(/^./, (c) => c.toUpperCase())}.`,
    };
  }, { cuantos, clave: (a) => String(a.p) });

  return {
    clave: "porcentaje_de_cantidad",
    arquetipo: "Calcula el porcentaje de una cantidad",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// CADA SITUACIÓN CON SUS TOTALES CREÍBLES: una clase de 260 alumnos o una
// excursión de 150 personas no existen. `null`: cualquier cantidad redonda.
const SITUACIONES_QUE = [
  { totales: [20, 24, 25, 28, 30], frase: (parte, total) => `En una clase de ${total} alumnos, ${parte} llevan gafas. ¿Qué porcentaje lleva gafas?` },
  { totales: [10, 20, 25, 40, 50], frase: (parte, total) => `De ${total} preguntas de un examen, Lucía ha acertado ${parte}. ¿Qué porcentaje ha acertado?` },
  { totales: [200, 300, 400, 500, 600, 800, 1000, 1200], frase: (parte, total) => `En un pueblo de ${total} habitantes, ${parte} son menores de edad. ¿Qué porcentaje son menores?` },
  { totales: null, frase: (parte, total) => `¿Qué porcentaje es ${parte} de ${total}?` },
];

// Un porcentaje de la lista y un total de la situación con el que la parte
// sale entera (y ni 0 ni el total).
function porcentajeYTotal(azar, lista, totales) {
  const p = azar.elige(lista);
  if (!totales) return { p, total: cantidadPara(azar, p) };
  // La parte, al menos 2: "1 llevan gafas" no concuerda, y el 5 % de 20 no
  // es un problema.
  const valen = totales.filter((t) => (p * t) % 100 === 0 && (p * t) / 100 >= 2);
  return valen.length ? { p, total: azar.elige(valen) } : null;
}

// ── "¿Qué porcentaje es?" (dificultad 2) ────────────────────────────────
export function quePorcentajeEs(azar, { cuantos = 4 } = {}) {
  const plan = azar.mezcla(SITUACIONES_QUE);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const situacion = plan[i % plan.length];
    i += 1;
    const elegido = porcentajeYTotal(azar, CORRIENTES, situacion.totales);
    if (!elegido) return null;
    const { p, total } = elegido;
    const parte = (p * total) / 100;
    const enunciado = situacion.frase(parte, total);
    return {
      latex: `${enunciado} ___ %`,
      latexResuelto: `${enunciado} ${p} %`,
      texto: `${enunciado} ___ %`,
      solucion: p,
      soloCociente: conComa(parte / total),
      razon: `${parte} : ${total} = ${conComa(parte / total)}, que es ${p} de cada 100: el ${p} %.`,
    };
  }, { cuantos, clave: (a) => String(a.solucion) });

  return {
    clave: "que_porcentaje_es",
    arquetipo: "Calcula qué porcentaje es una cantidad de otra",
    enunciado: "Calcula el porcentaje:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

const SITUACIONES_TOTAL = [
  { totales: null, frase: (p, parte) => `El ${p} % de un número es ${parte}. ¿Cuál es el número?` },
  { totales: [300, 400, 500, 600, 700, 800, 900], frase: (p, parte) => `El ${p} % de los alumnos de un instituto, ${parte}, van en bici. ¿Cuántos alumnos hay?` },
  { totales: [80, 100, 120, 150, 160, 200, 240, 300], frase: (p, parte) => `Marta ha ahorrado ${parte} €, que son el ${p} % de lo que cuesta una bici. ¿Cuánto cuesta la bici?` },
  { totales: [20, 24, 25, 30, 40, 50, 60], frase: (p, parte) => `En una excursión, ${parte} personas, el ${p} % del grupo, llevan gorra. ¿Cuántas personas van?` },
  { totales: [20, 24, 25, 28, 30], frase: (p, parte) => `En una clase, ${parte} alumnos, el ${p} %, han aprobado todo. ¿Cuántos alumnos hay en la clase?` },
];

// ── "Calcula el total a partir del porcentaje" (dificultad 3) ───────────
export function totalDesdePorcentaje(azar, { cuantos = 3 } = {}) {
  const plan = azar.mezcla(SITUACIONES_TOTAL);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const situacion = plan[i];
    if (!situacion) return null;
    const elegido = porcentajeYTotal(azar, [10, 20, 25, 50, 5, 30, 40, 60, 75], situacion.totales);
    if (!elegido) return null;
    i += 1;
    const { p, total } = elegido;
    const parte = (p * total) / 100;
    const enunciado = situacion.frase(p, parte);
    return {
      latex: `${enunciado} ___`,
      latexResuelto: `${enunciado} ${total}.`,
      texto: `${enunciado} ___`,
      solucion: total,
      deLaParte: conComa((p * parte) / 100),
      razon: `Si el ${p} % son ${parte}, el 1 % es ${parte} : ${p} y el 100 % es ${parte} · 100 : ${p} = ${total}.`,
    };
  }, { cuantos, clave: (a) => a.texto.slice(0, 12) });

  return {
    clave: "total_desde_porcentaje",
    arquetipo: "Calcula el total conociendo una parte y su porcentaje",
    enunciado: "Resuelve:",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
