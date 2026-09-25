import { reuneApartados } from "../../ejercicio.js";
import { frac, mcd, latexTalCual, textoTalCual } from "../fracciones/fraccion.js";

// PROPORCIONALIDAD, OBJETIVO 1: RAZONES Y PROPORCIONES (conceptos 1 y 2).
// Saber A.5: «Razones entre magnitudes: comprensión y representación de
// relaciones cuantitativas».
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   1 escribir la razón al revés (de chicos a chicas cuando se pide de
//     chicas a chicos);
//   2 el razonamiento ADITIVO: creer que 2/3 y 4/5 son proporción porque
//     "se ha sumado 2 a cada uno"; y en el término que falta, sumar la
//     diferencia en vez de multiplicar. Es el error más estudiado de todo
//     el razonamiento proporcional, y por eso los "no" de estas baterías
//     son siempre aditivos.

// Parejas de cosas que se cuentan, con el orden en que se pide la razón.
const PAREJAS = [
  ["chicas", "chicos", "En una clase hay {a} chicas y {b} chicos"],
  ["bolas rojas", "bolas azules", "En una caja hay {a} bolas rojas y {b} bolas azules"],
  ["partidos ganados", "partidos perdidos", "Un equipo ha ganado {a} partidos y ha perdido {b}"],
  ["vasos de agua", "vasos de zumo", "Una receta lleva {a} vasos de agua y {b} vasos de zumo"],
  ["gatos", "perros", "En un refugio hay {a} gatos y {b} perros"],
  ["libros de aventuras", "libros de misterio", "En una estantería hay {a} libros de aventuras y {b} de misterio"],
  ["canicas verdes", "canicas blancas", "En una bolsa hay {a} canicas verdes y {b} canicas blancas"],
  ["cromos repetidos", "cromos nuevos", "Leo tiene {a} cromos repetidos y {b} nuevos"],
  ["mesas", "sillas", "En un aula hay {a} mesas y {b} sillas"],
];

// ── "Escribe la razón y simplifícala" (dificultad 1) ────────────────────
// De 4 a 6. La razón se escribe como fracción y se simplifica: 12 chicas y
// 16 chicos, 12/16 = 3/4 ("3 chicas por cada 4 chicos"). La mitad de las
// veces se pide al revés del orden en que se nombran, que es lo que obliga
// a leer (error 1).
export function razonSimplificada(azar, { cuantos = 4 } = {}) {
  const plan = azar.mezcla(PAREJAS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const pareja = plan[i % plan.length];
    const alReves = i % 2 === 1;
    i += 1;
    const base = frac(azar.entero(1, 5), azar.entero(2, 6));
    if (base.n === base.d || mcd(base.n, base.d) !== 1) return null;
    const k = azar.entero(2, 6);
    const [a, b] = [base.n * k, base.d * k];
    const [pide1, pide2] = alReves ? [pareja[1], pareja[0]] : [pareja[0], pareja[1]];
    const [x, y] = alReves ? [b, a] : [a, b];
    const r = frac(x, y);
    const simplificada = { n: x / mcd(x, y), d: y / mcd(x, y) };
    const frase = `${pareja[2].replace("{a}", a).replace("{b}", b)}. Razón de ${pide1} a ${pide2}:`;
    return {
      latex: `${frase} ___`,
      latexResuelto: `${frase} $${latexTalCual(r)} = ${latexTalCual(simplificada)}$`,
      texto: `${frase} ___`,
      solucion: textoTalCual(simplificada),
      pareja: pareja[0],
      alReves: { n: simplificada.d, d: simplificada.n },
      razon: `Primero ${pide1} (${x}) y después ${pide2} (${y}): ${x}/${y}, que simplificada (entre ${mcd(x, y)}) es ${textoTalCual(simplificada)}, `
        + `es decir, ${simplificada.n} a ${simplificada.d}.`,
    };
  }, { cuantos, clave: (a) => a.pareja });

  return {
    clave: "razon_simplificada",
    arquetipo: "Escribe la razón y simplifícala",
    enunciado: "Escribe la razón como fracción y simplifícala:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// ── "¿Forman proporción?" (dificultad 1) ────────────────────────────────
// De 6 a 8 parejas de razones, mitad sí y mitad no. Los "no" son del
// error 2: se ha SUMADO lo mismo a los dos términos (2/3 y 4/5).
export function esProporcion(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const a = azar.entero(1, 9);
    const b = azar.entero(2, 12);
    if (a === b) return null;
    const si = i % 2 === 0;
    i += 1;
    const k = azar.entero(2, 5);
    const suma = azar.entero(1, 6);
    const [c, d] = si ? [a * k, b * k] : [a + suma, b + suma];
    // Un "no" que por casualidad fuese proporción no enseña nada.
    if (!si && a * d === b * c) return null;
    const cruzado = `${a} · ${d} = ${a * d} y ${b} · ${c} = ${b * c}`;
    const eL = `\\dfrac{${a}}{${b}} \\;\\text{y}\\; \\dfrac{${c}}{${d}}`;
    return {
      latex: `$${eL}$ ___`,
      latexResuelto: `$${eL}$ ${si ? "Sí" : "No"}`,
      texto: `${a}/${b} y ${c}/${d} ___`,
      solucion: si ? "sí" : "no",
      aditiva: !si,
      razon: si
        ? `Los productos cruzados son iguales (${cruzado}): sí. Los dos términos se han multiplicado por ${k}.`
        : `Los productos cruzados no coinciden (${cruzado}): no. Sumar ${suma} a los dos términos no da una razón igual.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "es_proporcion",
    arquetipo: "Comprueba si dos razones forman proporción",
    enunciado: "¿Forman proporción? Contesta sí o no:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Calcula el término que falta" (dificultad 2) ───────────────────────
// De 5 a 7: a/b = c/x o a/b = x/d, con resultado entero. El factor entre
// las dos razones no es siempre entero (6/4 = 9/x: x = 6), porque con un
// factor entero se resuelve "a ojo" y no hace falta el producto cruzado.
export function terminoDeProporcion(azar, { cuantos = 5 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const base = frac(azar.entero(1, 7), azar.entero(2, 8));
    if (base.n === base.d) return null;
    const simple = { n: base.n / mcd(base.n, base.d), d: base.d / mcd(base.n, base.d) };
    const k1 = azar.entero(1, 4);
    const k2 = azar.entero(2, 6);
    if (k1 === k2) return null;
    const [a, b] = [simple.n * k1, simple.d * k1];
    const [c, d] = [simple.n * k2, simple.d * k2];
    const huecoAbajo = i % 2 === 0;
    i += 1;
    const [x, dada] = huecoAbajo ? [d, c] : [c, d];
    const eL = huecoAbajo ? `\\dfrac{${a}}{${b}} = \\dfrac{${c}}{x}` : `\\dfrac{${a}}{${b}} = \\dfrac{x}{${d}}`;
    const eT = huecoAbajo ? `${a}/${b} = ${c}/x` : `${a}/${b} = x/${d}`;
    // Error 2: la diferencia sumada (de a a c se suma c − a; se suma lo
    // mismo a b).
    const aditiva = huecoAbajo ? b + (c - a) : a + (d - b);
    const producto = huecoAbajo ? `${b} · ${c} = ${b * c}` : `${a} · ${d} = ${a * d}`;
    const entre = huecoAbajo ? a : b;
    return {
      latex: `$${eL}$, $x =$ ___`,
      latexResuelto: `$${eL}$, $x = ${x}$`,
      texto: `${eT}, x = ___`,
      solucion: x,
      aditiva: aditiva > 0 ? aditiva : null,
      razon: `Productos cruzados: ${producto}, y se divide entre ${entre}: x = ${producto.split(" = ")[1]} : ${entre} = ${x}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "termino_de_proporcion",
    arquetipo: "Calcula el término que falta en la proporción",
    enunciado: "Calcula el término que falta:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
