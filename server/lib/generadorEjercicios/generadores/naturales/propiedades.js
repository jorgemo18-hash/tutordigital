import { reuneApartados } from "../../ejercicio.js";
import { milesTexto, milesLatex } from "../potenciasRaices/formato.js";

// NATURALES, OBJETIVO 3: PROPIEDADES Y CÁLCULO MENTAL (concepto 4). Saberes
// A.3 «Estrategias de cálculo mental con números naturales…» y «Propiedades
// de las operaciones…: cálculos de manera eficiente…».
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   4 aplicar la distributiva solo al primer sumando (7 · (10 + 3) = 73);
//   8 aplicar un truco a medias: por 5 multiplicar por 10 y no dividir
//     entre 2; por 99 multiplicar por 100 y no restar.

// ── "Aplica la propiedad distributiva" (dificultad 1) ───────────────────
// De 5 a 7: a · (b + c) y a · (b − c), con b redondo para que la
// distributiva sea de verdad el camino corto (7 · (100 − 2) = 700 − 14).
export function distributiva(azar, { cuantos = 5 } = {}) {
  const { apartados } = reuneApartados(() => {
    const a = azar.entero(3, 9);
    const b = azar.elige([10, 20, 30, 50, 100, 200]);
    const c = azar.entero(1, 9);
    const suma = azar.suerte(0.6);
    const r = suma ? a * (b + c) : a * (b - c);
    const op = suma ? "+" : "-";
    const opT = suma ? "+" : "−";
    return {
      latex: `$${a} \\cdot (${b} ${op} ${c}) =$ ___`,
      latexResuelto: `$${a} \\cdot (${b} ${op} ${c}) = ${a * b} ${op} ${a * c} = ${r}$`,
      texto: `${a} · (${b} ${opT} ${c}) = ___`,
      solucion: r,
      soloPrimero: suma ? a * b + c : a * b - c,
      razon: `El ${a} multiplica a los DOS: ${a} · ${b} ${opT} ${a} · ${c} = ${a * b} ${opT} ${a * c} = ${r}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "distributiva_naturales",
    arquetipo: "Calcula aplicando la propiedad distributiva",
    enunciado: "Calcula aplicando la propiedad distributiva:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Saca factor común" (dificultad 2) ──────────────────────────────────
// De 4 a 6: 8 · 25 + 8 · 75 = 8 · (25 + 75) = 8 · 100. Los otros dos
// sumandos se eligen para que su suma (o resta) sea redonda: es lo que
// hace que sacar factor común valga la pena.
const PAREJAS_REDONDAS = [[25, 75], [37, 63], [48, 52], [15, 85], [99, 1], [46, 54], [120, 80], [65, 35], [101, 1], [112, 12]];

export function factorComun(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const a = azar.entero(3, 12);
    const [b, c] = azar.elige(PAREJAS_REDONDAS);
    const resta = b > 100;
    const dentro = resta ? b - c : b + c;
    const op = resta ? "-" : "+";
    const opT = resta ? "−" : "+";
    const r = a * dentro;
    return {
      latex: `$${a} \\cdot ${b} ${op} ${a} \\cdot ${c} =$ ___`,
      latexResuelto: `$${a} \\cdot ${b} ${op} ${a} \\cdot ${c} = ${a} \\cdot (${b} ${op} ${c}) = ${a} \\cdot ${dentro} = ${milesLatex(r)}$`,
      texto: `${a} · ${b} ${opT} ${a} · ${c} = ___`,
      solucion: milesTexto(r),
      razon: `Los dos productos tienen el ${a}: se saca, ${a} · (${b} ${opT} ${c}) = ${a} · ${dentro} = ${milesTexto(r)}. Sin hacer ${a} · ${b}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "factor_comun_naturales",
    arquetipo: "Calcula sacando factor común",
    enunciado: "Calcula sacando factor común:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// Los trucos de cálculo mental: cómo se hace y qué sale haciéndolo a
// medias (error 8).
const TRUCOS = [
  { id: "por5", crea: (n) => ({ exp: `${n} · 5`, r: n * 5, como: `por 10 y la mitad: ${n} · 10 = ${n * 10}, y ${n * 10} : 2 = ${n * 5}`, medias: n * 10 }), n: [14, 98] },
  { id: "por25", crea: (n) => ({ exp: `${n} · 25`, r: n * 25, como: `por 100 y entre 4: ${n} · 100 = ${milesTexto(n * 100)}, y ${milesTexto(n * 100)} : 4 = ${milesTexto(n * 25)}`, medias: n * 100 }), n: [4, 48], par: 4 },
  { id: "por9", crea: (n) => ({ exp: `${n} · 9`, r: n * 9, como: `por 10 y quitar una vez: ${n * 10} − ${n} = ${n * 9}`, medias: n * 10 }), n: [12, 99] },
  { id: "por11", crea: (n) => ({ exp: `${n} · 11`, r: n * 11, como: `por 10 y sumar una vez: ${n * 10} + ${n} = ${n * 11}`, medias: n * 10 }), n: [12, 99] },
  { id: "por99", crea: (n) => ({ exp: `${n} · 99`, r: n * 99, como: `por 100 y quitar una vez: ${milesTexto(n * 100)} − ${n} = ${milesTexto(n * 99)}`, medias: n * 100 }), n: [3, 45] },
  { id: "entre5", crea: (n) => ({ exp: `${n * 5} : 5`, r: n, como: `entre 10 y el doble: ${n * 5} : 10 = ${n / 2}, y ${n / 2} · 2 = ${n}`, medias: n / 2 }), n: [12, 98], par: 2 },
];

// ── "Calcula de cabeza" (dificultad 1) ──────────────────────────────────
// De 6 a 8, un truco distinto en cada uno (y cuando se repite, con otro
// número): por 5, 25, 9, 11, 99 y entre 5.
export function calculoMental(azar, { cuantos = 6 } = {}) {
  const plan = [...azar.mezcla(TRUCOS), ...azar.mezcla(TRUCOS)];
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const t = plan[i % plan.length];
    let n = azar.entero(t.n[0], t.n[1]);
    if (t.par) n -= n % t.par;
    // Si el número no vale se sortea otro para EL MISMO truco: avanzar
    // aquí saltaría trucos y repetiría otros.
    if (n < t.n[0] || n % 10 === 0) return null;
    i += 1;
    const { exp, r, como, medias } = t.crea(n);
    const expL = exp.replace("·", "\\cdot");
    return {
      latex: `$${expL} =$ ___`,
      latexResuelto: `$${expL} = ${milesLatex(r)}$`,
      texto: `${exp} = ___`,
      solucion: milesTexto(r),
      truco: t.id,
      aMedias: milesTexto(medias),
      razon: `De cabeza, ${como}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "calculo_mental_trucos",
    arquetipo: "Calcula de cabeza con estrategias",
    enunciado: "Calcula de cabeza, sin hacer la cuenta en columna:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}
