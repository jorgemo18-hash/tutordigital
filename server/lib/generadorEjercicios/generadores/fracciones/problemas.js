import { reuneApartados } from "../../ejercicio.js";
import { frac, suma, resta, texto, textoTalCual } from "./fraccion.js";
import { fraccionPropia, denominadoresDistintos, propiaConDenominador } from "./eleccion.js";
import { losDe } from "./lenguaje.js";

// FRACCIONES, OBJETIVO 7: PROBLEMAS (concepto 8).
//
// PLANTILLAS ESCRITAS A MANO, como en Divisibilidad: la IA no escribe ni un
// enunciado. Las fracciones van en texto ("los 3/5"), no en fórmula: en un
// párrafo, una fracción apilada rompe el interlineado y se lee peor.
//
// Dos baterías con CONTEXTOS DISTINTOS (una hoja con las dos no repite
// ninguno), y cada una con UNO MÁS de los que puede pedir (3 apartados más
// el ejemplo): con justo cuatro, un contexto que fallara dejaba la batería
// sin ejemplo resuelto (visto impreso).
//   - la fracción de una cantidad, directa (dificultad 2);
//   - lo que QUEDA, o de dónde se partía (dificultad 3). Aquí vive el error
//     13 del tema: contestar lo gastado en vez de lo que queda, y su
//     respuesta-trampa es esa.

// "n : d · k" como se hace a mano, sin el "· 1" cuando la fracción es 1/d.
const cuenta = (n, f) => (f.n === 1 ? `${n} : ${f.d}` : `${n} : ${f.d} · ${f.n}`);

const DIRECTOS = [
  {
    id: "clase", unidad: "alumnos", cantidad: [20, 32],
    frase: (f, n) => `En una clase de ${n} alumnos, ${losDe(f)} van al instituto en autobús. ¿Cuántos alumnos van en autobús?`,
  },
  {
    id: "deposito", unidad: "litros", cantidad: [60, 600],
    frase: (f, n) => `Un depósito de ${n} litros está lleno hasta ${losDe(f)}. ¿Cuántos litros de agua tiene?`,
  },
  {
    id: "paga", unidad: "€", cantidad: [20, 120],
    frase: (f, n) => `Leo recibe ${n} € al mes y ahorra ${losDe(f)}. ¿Cuánto dinero ahorra al mes?`,
  },
  {
    id: "parque", unidad: "pinos", cantidad: [30, 240],
    frase: (f, n) => `En un parque hay ${n} árboles y ${losDe(f)} son pinos. ¿Cuántos pinos hay?`,
  },
  {
    id: "huerto", unidad: "m²", cantidad: [40, 300],
    frase: (f, n) => `Un huerto mide ${n} m² y ${losDe(f)} ${f.n === 1 ? "está plantado" : "están plantados"} de tomates. ¿Cuántos m² de tomates hay?`,
  },
];

// Una cantidad del rango que sea múltiplo del denominador.
function cantidadPara(azar, f, [desde, hasta]) {
  const minimo = Math.ceil(desde / f.d);
  const maximo = Math.floor(hasta / f.d);
  return minimo > maximo ? null : f.d * azar.entero(minimo, maximo);
}

function directo(azar, ctx) {
  const f = fraccionPropia(azar);
  if (!f) return null;
  const n = cantidadPara(azar, f, ctx.cantidad);
  if (!n) return null;
  const solucion = (n / f.d) * f.n;
  return {
    enunciado: ctx.frase(f, n),
    solucion,
    unidad: ctx.unidad,
    razon: `${losDe(f).replace(/^./, (c) => c.toUpperCase())} de ${n}: ${cuenta(n, f)} = ${solucion}.`,
  };
}

// Los de "lo que queda": cada uno sabe calcular su respuesta y la del error
// 13 (lo que se ha gastado, leído o recorrido).
const INDIRECTOS = [
  {
    id: "libro", unidad: "páginas",
    crea: (azar) => {
      const f = fraccionPropia(azar);
      const n = f && cantidadPara(azar, f, [90, 360]);
      if (!n) return null;
      const leidas = (n / f.d) * f.n;
      return {
        enunciado: `Un libro tiene ${n} páginas y Sara ya ha leído ${losDe(f)}. ¿Cuántas páginas le quedan por leer?`,
        solucion: n - leidas,
        otra: leidas,
        razon: `Ha leído ${cuenta(n, f)} = ${leidas} páginas; le quedan ${n} − ${leidas} = ${n - leidas}.`,
      };
    },
  },
  {
    id: "viaje", unidad: "km",
    crea: (azar) => {
      const f = fraccionPropia(azar);
      const n = f && cantidadPara(azar, f, [120, 900]);
      if (!n) return null;
      const hechos = (n / f.d) * f.n;
      return {
        enunciado: `Un viaje en coche es de ${n} km y ya se ${f.n === 1 ? "ha recorrido" : "han recorrido"} ${losDe(f)}. ¿Cuántos kilómetros faltan?`,
        solucion: n - hechos,
        otra: hechos,
        razon: `Se han recorrido ${cuenta(n, f)} = ${hechos} km; faltan ${n} − ${hechos} = ${n - hechos}.`,
      };
    },
  },
  {
    id: "entradas", unidad: "entradas",
    crea: (azar) => {
      const f = fraccionPropia(azar);
      const n = f && cantidadPara(azar, f, [100, 900]);
      if (!n) return null;
      const vendidas = (n / f.d) * f.n;
      return {
        enunciado: `Para un concierto hay ${n} entradas y ya se han vendido ${losDe(f)}. ¿Cuántas quedan por vender?`,
        solucion: n - vendidas,
        otra: vendidas,
        razon: `Se han vendido ${cuenta(n, f)} = ${vendidas}; quedan ${n} − ${vendidas} = ${n - vendidas}.`,
      };
    },
  },
  {
    id: "gastos", unidad: "de la paga",
    crea: (azar) => {
      const ds = denominadoresDistintos(azar, { tope: 24 });
      if (!ds) return null;
      const a = propiaConDenominador(azar, ds[0]);
      const b = propiaConDenominador(azar, ds[1]);
      if (!a || !b) return null;
      const gastado = suma(a, b);
      const queda = resta(frac(1), gastado);
      if (queda.n <= 0) return null;
      return {
        enunciado: `Nerea gasta ${losDe(a)} de su paga en el cine y ${losDe(b)} en un libro. ¿Qué fracción de la paga le queda?`,
        solucion: texto(queda),
        otra: texto(gastado),
        razon: `Gasta ${textoTalCual(a)} + ${textoTalCual(b)} = ${texto(gastado)}; le queda 1 − ${texto(gastado)} = ${texto(queda)}.`,
      };
    },
  },
  {
    id: "ahorro", unidad: "€",
    crea: (azar) => {
      const f = fraccionPropia(azar);
      if (!f || f.n === 1) return null;
      const unaParte = azar.entero(3, 15);
      const gastado = unaParte * f.n;
      const total = unaParte * f.d;
      return {
        enunciado: `Leo se ha gastado ${gastado} €, que son ${losDe(f)} de lo que tenía ahorrado. ¿Cuánto dinero tenía?`,
        solucion: total,
        // El error aquí es calcular la fracción del dato en vez de al revés.
        otra: Number.isInteger((gastado / f.d) * f.n) ? (gastado / f.d) * f.n : null,
        razon: `${gastado} € son ${f.n} partes de ${f.d}: una parte es ${gastado} : ${f.n} = ${unaParte} €, y todo son ${unaParte} · ${f.d} = ${total} €.`,
      };
    },
  },
];

function aApartado(p, contexto) {
  return {
    latex: `${p.enunciado} ___`,
    latexResuelto: `${p.enunciado} ${p.solucion} ${p.unidad}.`,
    texto: `${p.enunciado} ___`,
    solucion: p.solucion,
    otra: p.otra ?? null,
    contexto,
    razon: p.razon,
  };
}

// ── "Problemas de la fracción de una cantidad" (dificultad 2) ───────────
export function problemasFraccionDeCantidad(azar, { cuantos = 2 } = {}) {
  const plan = azar.mezcla(DIRECTOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const ctx = plan[i];
    i += 1;
    if (!ctx) return null;
    let p = null;
    for (let k = 0; k < 30 && !p; k += 1) p = directo(azar, ctx);
    return p && aApartado(p, ctx.id);
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "problemas_fraccion_cantidad",
    arquetipo: "Resuelve problemas de la fracción de una cantidad",
    enunciado: "Resuelve:",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── "Problemas de lo que queda" (dificultad 3) ──────────────────────────
export function problemasLoQueQueda(azar, { cuantos = 2 } = {}) {
  const plan = azar.mezcla(INDIRECTOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const ctx = plan[i];
    i += 1;
    if (!ctx) return null;
    let p = null;
    for (let k = 0; k < 30 && !p; k += 1) p = ctx.crea(azar);
    return p && aApartado({ ...p, unidad: ctx.unidad }, ctx.id);
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "problemas_lo_que_queda",
    arquetipo: "Resuelve problemas de lo que queda y del total",
    enunciado: "Resuelve. Lee bien qué se pregunta:",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
