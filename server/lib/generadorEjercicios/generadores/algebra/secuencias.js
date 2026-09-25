import { reuneApartados } from "../../ejercicio.js";
import { textoLineal, latexLineal, numeroTexto } from "./terminos.js";

// ÁLGEBRA, OBJETIVO 3: LA REGLA DE UNA SECUENCIA (concepto 4). Saber D.1:
// «Patrones, pautas y regularidades: observación y determinación de la
// regla de formación en casos sencillos».
//
// Solo secuencias LINEALES (se suma siempre lo mismo): son los "casos
// sencillos" del currículo, y las únicas cuya regla se escribe con lo que
// se sabe en 1.º (an + b). La diferencia puede ser negativa (la secuencia
// baja), y el primer término no es siempre la diferencia: si lo fuera, la
// regla sería siempre "dn" y no habría nada que descubrir.

function secuencia(azar, { conNegativa = true } = {}) {
  const d = azar.entero(2, 9) * (conNegativa && azar.suerte(0.2) ? -1 : 1);
  const primero = azar.entero(-5, 20);
  const b = primero - d;
  if (b === 0) return null;
  const terminos = Array.from({ length: 4 }, (_, k) => primero + d * k);
  return { d, b, primero, terminos };
}

const escribeLista = (lista) => lista.map(numeroTexto).join(", ");
const regla = ({ d, b }) => ({ a: d, b });

// ── "Escribe los dos términos siguientes" (dificultad 1) ────────────────
export function siguientesTerminos(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const s = secuencia(azar);
    if (!s) return null;
    const siguientes = [s.terminos[3] + s.d, s.terminos[3] + 2 * s.d];
    return {
      latex: `$${s.terminos.join(",\\; ")},$ ___, ___`,
      latexResuelto: `$${[...s.terminos, ...siguientes].join(",\\; ")}$`,
      texto: `${escribeLista(s.terminos)}, ___, ___`,
      solucion: siguientes,
      razon: `Va de ${numeroTexto(s.d)} en ${numeroTexto(s.d)}: ${numeroTexto(s.terminos[3])} ${s.d < 0 ? "−" : "+"} ${Math.abs(s.d)} = ${numeroTexto(siguientes[0])}, y otra vez: ${numeroTexto(siguientes[1])}.`,
    };
  }, { cuantos, clave: (a) => String(a.solucion[0]) });

  return {
    clave: "siguientes_terminos",
    arquetipo: "Escribe los dos términos siguientes de la secuencia",
    enunciado: "Escribe los dos términos que siguen:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Calcula un término lejano" (dificultad 2) ──────────────────────────
// De 3 a 4: el término 20, 50 o 100, que no se alcanza contando. Es el paso
// que obliga a buscar la regla.
export function terminoLejano(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const s = secuencia(azar, { conNegativa: false });
    if (!s) return null;
    const n = azar.elige([10, 20, 30, 50, 100]);
    const valor = s.d * n + s.b;
    return {
      latex: `$${s.terminos.join(",\\; ")}, \\dots$ El término ${n}: ___`,
      latexResuelto: `$${s.terminos.join(",\\; ")}, \\dots$ El término ${n}: $${valor}$`,
      texto: `${escribeLista(s.terminos)}, … El término ${n}: ___`,
      solucion: valor,
      n,
      secuencia: s,
      razon: `Del primero al ${n}.º se suma ${s.d} otras ${n - 1} veces: ${numeroTexto(s.primero)} + ${s.d} · ${n - 1} = ${valor}.`,
    };
  }, { cuantos, clave: (a) => String(a.secuencia.d) });

  return {
    clave: "termino_lejano",
    arquetipo: "Calcula un término lejano de la secuencia",
    enunciado: "Calcula el término que se pide sin escribir todos los anteriores:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── "Escribe la regla: el término n" (dificultad 3) ─────────────────────
export function terminoGeneral(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const s = secuencia(azar);
    if (!s) return null;
    const r = regla(s);
    return {
      latex: `$${s.terminos.join(",\\; ")}, \\dots$ Término $n$: ___`,
      latexResuelto: `$${s.terminos.join(",\\; ")}, \\dots$ Término $n$: $${latexLineal(r, "n")}$`,
      texto: `${escribeLista(s.terminos)}, … Término n: ___`,
      solucion: textoLineal(r, "n"),
      secuencia: s,
      razon: `Va de ${numeroTexto(s.d)} en ${numeroTexto(s.d)}, así que empieza por ${textoLineal({ a: s.d, b: 0 }, "n")}. `
        + `Para n = 1 eso da ${numeroTexto(s.d)} y el primero es ${numeroTexto(s.primero)}: hay que ${s.b > 0 ? `sumar ${s.b}` : `restar ${-s.b}`}. Regla: ${textoLineal(r, "n")}.`,
    };
  }, { cuantos, clave: (a) => a.solucion });

  return {
    clave: "termino_general",
    arquetipo: "Escribe la regla de la secuencia (el término n)",
    enunciado: "Escribe la expresión del término que ocupa el lugar n:",
    tipo: "ejercicio",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
