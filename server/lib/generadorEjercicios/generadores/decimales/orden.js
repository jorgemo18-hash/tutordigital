import { reuneApartados } from "../../ejercicio.js";
import { dec, texto, latex, compara, alAzar } from "./decimal.js";

// DECIMALES, OBJETIVO 2: COMPARAR, ORDENAR Y REDONDEAR (conceptos 3 y 4).
// Saberes A.4 «Comparación y ordenación de fracciones, decimales y
// porcentajes…» y A.2 «Realización de estimaciones con la precisión
// requerida».
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   1 creer que el que tiene MÁS CIFRAS decimales es mayor (3,125 > 3,4;
//     0,50 > 0,5): es el error más conocido de los decimales, y por eso
//     casi todas las parejas lo ponen a prueba;
//   3 redondear cortando, sin mirar la cifra siguiente (3,47 a las décimas
//     → 3,4).

const SIGNO = { "-1": "<", 0: "=", 1: ">" };

// Lo que contesta quien cree que más cifras es más: compara las partes
// decimales como si fueran números enteros ("125 > 4"). Con la misma parte
// entera; si no, se fija en la entera, como todo el mundo.
function conError1(a, b) {
  const [ea, eb] = [Math.floor(a.n / 10 ** a.e), Math.floor(b.n / 10 ** b.e)];
  if (ea !== eb) return SIGNO[Math.sign(ea - eb)];
  const [da, db] = [a.n % 10 ** a.e, b.n % 10 ** b.e];
  return SIGNO[Math.sign(da - db)];
}

// Una pareja que pone a prueba el error 1: misma parte entera, distinto
// número de cifras decimales, y el de más cifras NO es el mayor (o son
// iguales con un cero de más).
function parejaTrampa(azar, tipo) {
  const entera = azar.entero(0, 9);
  if (tipo === "ceros") {
    const a = alAzar(azar, { e: 1, min: entera, max: entera });
    if (!a) return null;
    return { a, b: a, cifrasB: 2 };
  }
  const corto = alAzar(azar, { e: 1, min: entera, max: entera });
  const largo = alAzar(azar, { e: azar.entero(2, 3), min: entera, max: entera });
  if (!corto || !largo || compara(corto, largo) <= 0) return null;
  return azar.suerte(0.5) ? { a: corto, b: largo } : { a: largo, b: corto };
}

// ── "Compara: <, > o =" (dificultad 1) ──────────────────────────────────
// De 6 a 8: casi todas trampa del error 1 (una de ellas, 0,5 y 0,50) y
// alguna "normal" para que no todas digan lo mismo.
export function comparaDecimales(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const tipo = i === 1 ? "ceros" : i % 4 === 3 ? "normal" : "trampa";
    i += 1;
    let p;
    if (tipo === "normal") {
      const a = alAzar(azar, { e: azar.entero(1, 3), min: 0, max: 9 });
      const b = alAzar(azar, { e: azar.entero(1, 3), min: 0, max: 9 });
      p = a && b && compara(a, b) !== 0 ? { a, b } : null;
    } else {
      p = parejaTrampa(azar, tipo);
    }
    if (!p) return null;
    const cifrasB = p.cifrasB || 0;
    const s = SIGNO[compara(p.a, p.b)];
    const bT = texto(p.b, cifrasB);
    const bL = latex(p.b, cifrasB);
    // Con el error 1 el que tiene más cifras escritas gana: 0,50 > 0,5.
    const trampa = tipo === "ceros" ? "<" : conError1(p.a, p.b);
    return {
      latex: `$${latex(p.a)} \\;\\square\\; ${bL}$ ___`,
      latexResuelto: `$${latex(p.a)} ${s} ${bL}$`,
      texto: `${texto(p.a)} □ ${bT} ___`,
      solucion: s,
      conError1: trampa,
      razon: tipo === "ceros"
        ? `Un cero a la derecha de la última cifra decimal no cambia nada: ${texto(p.a)} = ${bT}.`
        : `Se igualan las cifras decimales poniendo ceros: ${texto(p.a, Math.max(p.a.e, p.b.e))} y ${texto(p.b, Math.max(p.a.e, p.b.e))}. Así se ve que ${texto(p.a)} ${s} ${bT}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "compara_decimales",
    arquetipo: "Compara los números decimales con <, > o =",
    enunciado: "Escribe <, > o = en el □:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Ordena de menor a mayor" (dificultad 2) ────────────────────────────
// De 2 a 3 listas de cinco números con la misma parte entera y distinto
// número de cifras: ordenarlas "por la longitud" o "por la parte decimal
// como entero" (error 1) da otro orden.
export function ordenaDecimales(azar, { cuantos = 2 } = {}) {
  const { apartados } = reuneApartados(() => {
    const entera = azar.entero(0, 9);
    const lista = [];
    for (let k = 0; k < 20 && lista.length < 5; k += 1) {
      const d = alAzar(azar, { e: 1 + (lista.length % 3), min: entera, max: entera });
      if (d && !lista.some((x) => compara(x, d) === 0)) lista.push(d);
    }
    if (lista.length < 5) return null;
    const bien = [...lista].sort(compara);
    const mal = [...lista].sort((a, b) => (a.n % 10 ** a.e) - (b.n % 10 ** b.e));
    if (mal.every((x, j) => x === bien[j])) return null;
    const mezclada = azar.mezcla(lista);
    return {
      latex: `$${mezclada.map((d) => latex(d)).join(";\\; ")}$ → _________`,
      latexResuelto: `$${bien.map((d) => latex(d)).join(" < ")}$`,
      texto: `${mezclada.map((d) => texto(d)).join("; ")} → _________`,
      solucion: bien.map((d) => texto(d)),
      conError1: mal.map((d) => texto(d)),
      razon: `Con todos con ${bien.reduce((m, d) => Math.max(m, d.e), 0)} cifras decimales (poniendo ceros) se comparan como números enteros: ${bien.map((d) => texto(d, 3)).join(" < ")}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "ordena_decimales",
    arquetipo: "Ordena los números decimales de menor a mayor",
    enunciado: "Ordena de menor a mayor:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

const A_QUE = [
  { nombre: "las unidades", e: 0 },
  { nombre: "las décimas", e: 1 },
  { nombre: "las centésimas", e: 2 },
];

// ── "Redondea" (dificultad 2) ───────────────────────────────────────────
// De 5 a 7: la mitad hacia arriba (la cifra siguiente es 5 o más), que es
// donde cortar (error 3) da otra cosa; y algún 9 que "se lleva una"
// (2,96 a las décimas → 3,0).
export function redondeaDecimal(azar, { cuantos = 5 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const aQue = A_QUE[i % A_QUE.length];
    const arriba = i % 2 === 0;
    i += 1;
    const d = alAzar(azar, { e: aQue.e + azar.entero(1, 2), min: 0, max: 19 });
    if (!d) return null;
    const sobran = d.e - aQue.e;
    const siguiente = Math.floor(d.n / 10 ** (sobran - 1)) % 10;
    if ((siguiente >= 5) !== arriba) return null;
    const cortado = dec(Math.floor(d.n / 10 ** sobran), aQue.e);
    const redondeado = arriba ? dec(Math.floor(d.n / 10 ** sobran) + 1, aQue.e) : cortado;
    // A las décimas, 3,0 se escribe con su cero: dice hasta dónde se ha
    // redondeado.
    return {
      latex: `$${latex(d)}$ a ${aQue.nombre}: ___`,
      latexResuelto: `$${latex(d)}$ a ${aQue.nombre}: $${latex(redondeado, aQue.e)}$`,
      texto: `${texto(d)} a ${aQue.nombre}: ___`,
      solucion: texto(redondeado, aQue.e),
      cortado: texto(cortado, aQue.e),
      razon: `Se mira la cifra siguiente, un ${siguiente}: ${arriba ? `como es 5 o más, se sube uno: ${texto(redondeado, aQue.e)}` : `como es menos de 5, se deja: ${texto(redondeado, aQue.e)}`}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "redondea_decimal",
    arquetipo: "Redondea el número decimal",
    enunciado: "Redondea:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
