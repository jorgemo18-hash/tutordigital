import { reuneApartados } from "../../ejercicio.js";
import { frac, compara, mcd, mcm, latexTalCual, textoTalCual } from "./fraccion.js";
import { fraccionPropia, propiaConDenominador } from "./eleccion.js";

// FRACCIONES, OBJETIVO 3: COMPARAR Y ORDENAR (concepto 4). Saber A.4:
// «Comparación y ordenación de fracciones, decimales y porcentajes».
//
// EL ERROR QUE TIENE QUE PODER PROVOCAR (error 8 del tema): creer que con
// más denominador la fracción es mayor (1/5 > 1/3, "porque 5 > 3"). Solo
// se ve con el MISMO NUMERADOR, así que esas parejas no pueden faltar.

const SIGNO = { "-1": "<", 0: "=", 1: ">" };

// Los tres tipos de pareja, y cada uno pide una estrategia distinta: con el
// mismo denominador se miran los numeradores; con el mismo numerador, al
// revés; con los dos distintos, hay que reducir a común denominador (o
// multiplicar en cruz).
function parejaDeTipo(azar, tipo) {
  if (tipo === "mismo_denominador") {
    const d = azar.entero(3, 12);
    const a = propiaConDenominador(azar, d);
    const b = propiaConDenominador(azar, d);
    return a && b && a.n !== b.n ? [a, b] : null;
  }
  if (tipo === "mismo_numerador") {
    const n = azar.entero(1, 5);
    const d1 = azar.entero(n + 1, 12);
    const d2 = azar.entero(n + 1, 12);
    // Las dos irreducibles: 4/12 junto a 4/7 invita a simplificar primero,
    // y entonces ya no tienen el mismo numerador.
    if (d1 === d2 || mcd(n, d1) !== 1 || mcd(n, d2) !== 1) return null;
    return [frac(n, d1), frac(n, d2)];
  }
  const a = fraccionPropia(azar);
  const b = fraccionPropia(azar);
  if (!a || !b || a.d === b.d || a.n === b.n || mcm(a.d, b.d) > 60) return null;
  return [a, b];
}

function razonDeComparar([a, b], tipo, signo) {
  if (tipo === "mismo_denominador") return `Mismo denominador: es mayor la de mayor numerador. ${textoTalCual(a)} ${signo} ${textoTalCual(b)}.`;
  if (tipo === "mismo_numerador") return `Mismo numerador: es mayor la de MENOR denominador (partes más grandes). ${textoTalCual(a)} ${signo} ${textoTalCual(b)}.`;
  const m = mcm(a.d, b.d);
  return `A denominador ${m}: ${textoTalCual(a)} = ${a.n * (m / a.d)}/${m} y ${textoTalCual(b)} = ${b.n * (m / b.d)}/${m}. ${textoTalCual(a)} ${signo} ${textoTalCual(b)}.`;
}

// ── "Compara con <, > o =" (dificultad 1) ───────────────────────────────
// De 6 a 8, con los tres tipos, dos parejas al menos de mismo numerador.
export function comparaFracciones(azar, { cuantos = 6 } = {}) {
  const plan = azar.mezcla(["mismo_numerador", "mismo_numerador", "mismo_denominador", "distintos", "distintos"]);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const tipo = plan[i] || azar.elige(["mismo_numerador", "mismo_denominador", "distintos"]);
    i += 1;
    // Se reintenta DENTRO del tipo: si se pasara al siguiente, un intento
    // fallido se comería una de las parejas obligatorias de mismo numerador.
    let par = null;
    for (let k = 0; k < 40 && !par; k += 1) par = parejaDeTipo(azar, tipo);
    if (!par) return null;
    const signo = SIGNO[compara(par[0], par[1])];
    return {
      latex: `$${latexTalCual(par[0])}$ ___ $${latexTalCual(par[1])}$`,
      latexResuelto: `$${latexTalCual(par[0])} ${signo} ${latexTalCual(par[1])}$`,
      texto: `${textoTalCual(par[0])} ___ ${textoTalCual(par[1])}`,
      solucion: signo,
      pareja: par,
      tipoDePareja: tipo,
      razon: razonDeComparar(par, tipo, signo),
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "compara_fracciones",
    arquetipo: "Compara las fracciones con <, > o =",
    enunciado: "Escribe <, > o =:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 3,
    apartados,
  };
}

// ── "Ordena de menor a mayor" (dificultad 2) ────────────────────────────
// De 2 a 3 listas de cuatro fracciones con denominadores distintos y un
// denominador común de hasta 60, para que se pueda hacer a mano.
function listaParaOrdenar(azar) {
  const lista = [];
  for (let k = 0; k < 40 && lista.length < 4; k += 1) {
    const f = fraccionPropia(azar);
    if (!f || lista.some((g) => g.d === f.d || compara(g, f) === 0)) continue;
    lista.push(f);
  }
  if (lista.length < 4) return null;
  const comun = lista.reduce((m, f) => mcm(m, f.d), 1);
  return comun <= 60 ? { lista, comun } : null;
}

export function ordenaFracciones(azar, { cuantos = 2 } = {}) {
  const { apartados } = reuneApartados(() => {
    const l = listaParaOrdenar(azar);
    if (!l) return null;
    const ordenada = [...l.lista].sort(compara);
    const enComun = l.lista.map((f) => `${textoTalCual(f)} = ${f.n * (l.comun / f.d)}/${l.comun}`);
    const lista = l.lista.map(latexTalCual).join(",\\quad ");
    return {
      latex: `$${lista}$ → _________`,
      latexResuelto: `$${ordenada.map(latexTalCual).join(" < ")}$`,
      texto: `${l.lista.map(textoTalCual).join(", ")} → ___`,
      solucion: ordenada.map(textoTalCual),
      lista: l.lista,
      razon: `A denominador ${l.comun}: ${enComun.join("; ")}. Se ordenan los numeradores.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "ordena_fracciones",
    arquetipo: "Ordena las fracciones de menor a mayor",
    enunciado: "Ordena de menor a mayor:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
