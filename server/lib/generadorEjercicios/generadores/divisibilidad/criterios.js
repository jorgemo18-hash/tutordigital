import { reuneApartados } from "../../ejercicio.js";
import { sumaDeCifras } from "./aritmetica.js";

// DIVISIBILIDAD, OBJETIVO 2: CRITERIOS DE DIVISIBILIDAD (concepto 3).
//
// Por 2, 3, 5 y 10, que son los que dan todos los materiales de 1.º ESO.
// El 9 y el 11 salen en algunos libros y en otros no; una hoja que los
// pidiera sería de un libro y no del curso.
//
// EL ERROR QUE ESTAS BATERÍAS TIENEN QUE PODER PROVOCAR (error 3 del tema):
// aplicar al 3 el criterio del 2 y del 5, MIRANDO LA ÚLTIMA CIFRA ("123
// acaba en 3, es divisible por 3"; "31 no"… "33 sí"). Por eso hay números
// divisibles por 3 que no acaban en 0, 3, 6 ni 9, y números que acaban en
// 3 o en 9 sin ser divisibles por 3.

const CRITERIOS = [2, 3, 5, 10];

function divisiblesDe(n) {
  return CRITERIOS.filter((k) => n % k === 0);
}

const cifrasSumadas = (n) => String(n).split("").join(" + ");

function razonCriterios(n) {
  const u = n % 10;
  const final = u === 0
    ? "Acaba en 0: por 2, por 5 y por 10 sí."
    : u === 5
    ? "Acaba en 5: por 5 sí; por 2 y por 10 no."
    : u % 2 === 0
    ? `Acaba en ${u}, que es par: por 2 sí; por 5 y por 10 no.`
    : `Acaba en ${u}: ni por 2, ni por 5, ni por 10.`;
  const s = sumaDeCifras(n);
  const tres = s % 3 === 0
    ? `${cifrasSumadas(n)} = ${s}, múltiplo de 3: por 3 sí.`
    : `${cifrasSumadas(n)} = ${s}, que no es múltiplo de 3: por 3 no.`;
  return `${final} ${tres}`;
}

// Los perfiles que tiene que haber en la batería, para que no se conteste
// con una regla fija. Cada uno dice por cuáles es divisible.
const PERFILES = [
  { quiere: [3], trampa: true },            // divisible por 3 y NO acaba en 0, 3, 6, 9
  { quiere: [], trampa: true },             // acaba en 3 o en 9 y NO es divisible por 3
  { quiere: [2, 3, 5, 10] },
  { quiere: [2, 3] },
  { quiere: [3, 5] },
  { quiere: [2] },
  { quiere: [5] },
  { quiere: [2, 5, 10] },
];

function numeroConPerfil(azar, { quiere, trampa }) {
  for (let intento = 0; intento < 400; intento += 1) {
    const n = azar.entero(100, 3000);
    const iguales = divisiblesDe(n).join() === quiere.join();
    if (!iguales) continue;
    const u = n % 10;
    if (trampa && quiere.includes(3) && [0, 3, 6, 9].includes(u)) continue;
    if (trampa && !quiere.length && ![3, 9].includes(u)) continue;
    return n;
  }
  return null;
}

// ── "¿Por cuáles de 2, 3, 5 y 10 es divisible?" (dificultad 1) ───────────
// De 5 a 7 números de tres o cuatro cifras.
export function divisiblePor(azar, { cuantos = 5 } = {}) {
  // Los dos perfiles-trampa primero (van siempre) y el resto sorteado.
  const [t1, t2, ...resto] = PERFILES;
  const plan = [...azar.mezcla([t1, t2]), ...azar.mezcla(resto)];
  while (plan.length < cuantos + 10) plan.push(azar.elige(PERFILES));
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const perfil = plan[i];
    i += 1;
    if (!perfil) return null;
    const n = numeroConPerfil(azar, perfil);
    if (!n) return null;
    const lista = divisiblesDe(n);
    const solucion = lista.length ? lista : "ninguno";
    const escrito = lista.length ? lista.join(", ") : "ninguno";
    return {
      latex: `$${n}$: ______`,
      latexResuelto: `$${n}$: ${escrito}`,
      texto: `${n}: ___`,
      solucion,
      numero: n,
      razon: razonCriterios(n),
    };
  }, { cuantos, clave: (a) => String(a.numero) });

  return {
    clave: "divisible_por",
    arquetipo: "Indica por cuáles de 2, 3, 5 y 10 es divisible",
    enunciado: "Sin hacer la división, escribe por cuáles de 2, 3, 5 y 10 es divisible cada número:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Escribe las cifras que faltan para que sea divisible" (dificultad 2) ─
//
// De 3 a 4 números con una cifra tapada. Hay que dar TODAS las cifras que
// valen, no una: con una sola se acierta probando, y con todas hay que
// entender el criterio (el 3 admite tres o cuatro cifras distintas).
//
// El hueco nunca es la primera cifra: un 0 delante no es una cifra.
const PEDIDOS = [
  { divisores: [3], hueco: "medio" },
  { divisores: [3], hueco: "final" },
  { divisores: [2, 3], hueco: "final" },
  { divisores: [3, 5], hueco: "final" },
  { divisores: [3], hueco: "medio" },
];

const nombreDePedido = (divs) => divs.join(" y por ");

function numeroConHueco(azar, { divisores, hueco }) {
  const largo = azar.entero(3, 4);
  const cifras = Array.from({ length: largo }, (_, k) => (k === 0 ? azar.entero(1, 9) : azar.entero(0, 9)));
  const posicion = hueco === "final" ? largo - 1 : azar.entero(1, largo - 2);
  const valen = [];
  for (let c = 0; c <= 9; c += 1) {
    const n = Number(cifras.map((x, k) => (k === posicion ? c : x)).join(""));
    if (divisores.every((d) => n % d === 0)) valen.push(c);
  }
  // Ninguna cifra posible no es un ejercicio (pasa con "por 3 y por 5" y el
  // hueco al final). Con el 3 solo siempre valen tres o cuatro.
  if (!valen.length) return null;
  return { cifras, posicion, valen };
}

function razonDeHueco({ cifras, posicion, valen }, divisores) {
  const conocidas = cifras.filter((_, k) => k !== posicion);
  const suma = conocidas.reduce((s, c) => s + c, 0);
  const partes = [];
  if (divisores.includes(3)) {
    const enOrden = cifras.map((c, k) => (k === posicion ? "□" : c)).join(" + ");
    partes.push(`Para el 3, ${enOrden} = ${suma} + □ tiene que ser múltiplo de 3`);
  }
  if (divisores.includes(2)) partes.push("para el 2, la última cifra tiene que ser par");
  if (divisores.includes(5)) partes.push("para el 5, tiene que acabar en 0 o en 5");
  const texto = partes.join("; ");
  const cierre = valen.length === 1 ? `Solo vale el ${valen[0]}.` : `Valen: ${valen.join(", ")}.`;
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}. ${cierre}`;
}

export function cifraQueFalta(azar, { cuantos = 3 } = {}) {
  const plan = [...PEDIDOS];
  while (plan.length < cuantos + 10) plan.push(azar.elige(PEDIDOS));
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const pedido = plan[i];
    i += 1;
    if (!pedido) return null;
    const numero = numeroConHueco(azar, pedido);
    if (!numero) return null;
    // Las cifras juntas, como se escribe un número: con espacios entre ellas
    // "4 □ 3 1" parecen cuatro números sueltos.
    const conHuecoLatex = numero.cifras.map((c, k) => (k === numero.posicion ? "{\\square}" : c)).join("");
    const conHuecoTexto = numero.cifras.map((c, k) => (k === numero.posicion ? "□" : c)).join("");
    const frase = `$${conHuecoLatex}$, divisible por ${nombreDePedido(pedido.divisores)}:`;
    return {
      latex: `${frase} ___`,
      latexResuelto: `${frase} ${numero.valen.join(", ")}`,
      texto: `${conHuecoTexto}, divisible por ${nombreDePedido(pedido.divisores)}: ___`,
      solucion: numero.valen,
      cifras: numero.cifras,
      posicion: numero.posicion,
      divisores: pedido.divisores,
      razon: razonDeHueco(numero, pedido.divisores),
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "cifra_que_falta",
    arquetipo: "Escribe todas las cifras que hacen divisible el número",
    enunciado: "Escribe todas las cifras que pueden ir en el □:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
