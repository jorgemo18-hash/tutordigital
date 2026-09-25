import { reuneApartados } from "../../ejercicio.js";
import { milesTexto, milesLatex } from "../potenciasRaices/formato.js";

// NATURALES, OBJETIVO 1: EL SISTEMA DE NUMERACIÓN, REDONDEAR Y ESTIMAR
// (conceptos 1 y 2). Saberes A.2 «Realización de estimaciones con la
// precisión requerida» y A.1 «Adaptación del conteo al tamaño de los
// números».
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   1 redondear cortando, sin mirar la cifra siguiente (4 870 a los
//     millares → 4 000);
//   2 confundir la cifra con su valor (en 3 745 210, el 4 "vale 4").

const ORDENES = [
  { nombre: "decenas", valor: 10 },
  { nombre: "centenas", valor: 100 },
  { nombre: "millares", valor: 1000 },
  { nombre: "decenas de millar", valor: 10000 },
  { nombre: "centenas de millar", valor: 100000 },
  { nombre: "unidades de millón", valor: 1000000 },
];

// ── "¿Cuánto vale la cifra?" (dificultad 1) ─────────────────────────────
// De 6 a 8 números de 5 a 7 cifras, todas distintas (así "el 4" es uno
// solo): se pregunta cuánto vale una de ellas.
export function valorDeLaCifra(azar, { cuantos = 6 } = {}) {
  const { apartados } = reuneApartados(() => {
    const longitud = azar.entero(5, 7);
    const cifras = azar.mezcla([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, longitud);
    if (cifras[0] === 0) return null;
    const n = Number(cifras.join(""));
    // Una cifra que no sea 0 ni la de las unidades.
    const pos = azar.entero(1, longitud - 1);
    const cifra = cifras[longitud - 1 - pos];
    if (cifra === 0) return null;
    const valor = cifra * 10 ** pos;
    return {
      latex: `En $${milesLatex(n)}$, el ${cifra} vale ___`,
      latexResuelto: `En $${milesLatex(n)}$, el ${cifra} vale $${milesLatex(valor)}$`,
      texto: `En ${milesTexto(n)}, el ${cifra} vale ___`,
      solucion: milesTexto(valor),
      cifra: String(cifra),
      razon: `El ${cifra} está en el lugar de las ${ORDENES[pos - 1].nombre}: vale ${cifra} · ${milesTexto(10 ** pos)} = ${milesTexto(valor)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "valor_de_la_cifra",
    arquetipo: "Di cuánto vale una cifra según su posición",
    enunciado: "Escribe cuánto vale la cifra:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// ── "Redondea" (dificultad 1) ───────────────────────────────────────────
// De 6 a 8, a las decenas, centenas o millares; la mitad hacia arriba, que
// es donde cortar (error 1) da otra cosa, y alguno con 9 que se lleva una
// (6 970 a las centenas → 7 000).
export function redondeaNatural(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const orden = ORDENES[i % 3];
    const arriba = i % 2 === 0;
    i += 1;
    const n = azar.entero(orden.valor * 3, orden.valor * 300);
    const siguiente = Math.floor(n / (orden.valor / 10)) % 10;
    if ((siguiente >= 5) !== arriba || n % orden.valor === 0) return null;
    const cortado = Math.floor(n / orden.valor) * orden.valor;
    const r = arriba ? cortado + orden.valor : cortado;
    return {
      latex: `$${milesLatex(n)}$ a las ${orden.nombre}: ___`,
      latexResuelto: `$${milesLatex(n)}$ a las ${orden.nombre}: $${milesLatex(r)}$`,
      texto: `${milesTexto(n)} a las ${orden.nombre}: ___`,
      solucion: milesTexto(r),
      cortado: milesTexto(cortado),
      razon: `Se mira la cifra siguiente, un ${siguiente}: ${arriba ? "5 o más, se sube uno" : "menos de 5, se deja"}, y lo de detrás se pone a 0: ${milesTexto(r)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "redondea_natural",
    arquetipo: "Redondea el número natural",
    enunciado: "Redondea:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Estima redondeando" (dificultad 2) ─────────────────────────────────
// De 4 a 6: sumas, restas y productos que se estiman redondeando cada
// número antes de operar (489 + 312 → 500 + 300 = 800). Se pide la
// ESTIMACIÓN, no la cuenta: es lo que dice A.2, «con la precisión
// requerida».
export function estimaOperacion(azar, { cuantos = 4 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const tipo = ["suma", "resta", "producto"][i % 3];
    i += 1;
    const redondea = (n, v) => Math.round(n / v) * v;
    if (tipo === "producto") {
      const a = azar.entero(21, 98);
      const b = azar.entero(3, 9);
      const ra = redondea(a, 10);
      if (ra === a) return null;
      return {
        latex: `$${a} \\cdot ${b}$ ≈ ___`,
        latexResuelto: `$${a} \\cdot ${b}$ ≈ $${ra} \\cdot ${b} = ${ra * b}$`,
        texto: `${a} · ${b} ≈ ___`,
        solucion: String(ra * b),
        razon: `${a} a las decenas es ${ra}: ${ra} · ${b} = ${ra * b}. (La cuenta exacta da ${a * b}: la estimación está cerca.)`,
      };
    }
    const a = azar.entero(120, 980);
    const b = azar.entero(110, tipo === "resta" ? a - 100 : 980);
    const [ra, rb] = [redondea(a, 100), redondea(b, 100)];
    if (ra === a || rb === b || rb === 0 || (tipo === "resta" && ra <= rb)) return null;
    const op = tipo === "suma" ? "+" : "-";
    const opT = tipo === "suma" ? "+" : "−";
    const r = tipo === "suma" ? ra + rb : ra - rb;
    const exacta = tipo === "suma" ? a + b : a - b;
    return {
      latex: `$${a} ${op} ${b}$ ≈ ___`,
      latexResuelto: `$${a} ${op} ${b}$ ≈ $${ra} ${op} ${rb} = ${r}$`,
      texto: `${a} ${opT} ${b} ≈ ___`,
      solucion: String(r),
      razon: `A las centenas: ${a} → ${ra} y ${b} → ${rb}. ${ra} ${opT} ${rb} = ${r}. (La cuenta exacta da ${exacta}.)`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "estima_operacion",
    arquetipo: "Estima el resultado redondeando antes de operar",
    enunciado: "Estima redondeando (sumas y restas a las centenas; productos, a las decenas):",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
