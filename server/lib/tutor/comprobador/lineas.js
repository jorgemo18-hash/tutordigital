// EL COMPROBADOR: ¿cada línea del alumno sigue siendo el mismo ejercicio?
//
// Decidido con Jorge el 2/10/2026 (claude/tutor-arquitectura.md, apartado 8):
// cada línea se compara con el ENUNCIADO, no solo con la línea anterior. Así
// se encuentra el error arrastrado: si en la línea 2 cambia un signo y en las
// 3 y 4 sigue bien desde ahí, las 3 y 4 son coherentes con la 2 pero ninguna
// es equivalente al enunciado. La primera que deja de serlo es donde empezó
// el error, diga lo que diga la IA.
//
// Dos tipos de referencia:
//   - ecuacion: "2*(x+3) = 14". Una línea es equivalente si tiene las mismas
//     soluciones. En 1.º ESO las ecuaciones son de primer grado: se resuelve
//     cada línea como recta (ax + b = 0) y se comparan las soluciones.
//   - expresion: "2*x - 8" (reducir, valor numérico). Equivalente si da lo
//     mismo en varios puntos.
//
// Cada línea vuelve con `leida` (si se entendió) y `equivalente` (true,
// false o null si no se pudo decidir). Nunca se da por buena ni por mala una
// línea que no se ha entendido: sale como «?».
import { lee, evalua, variables, casiIgual } from "../../verificador/expresionDeTexto.js";
import { normaliza } from "./notacionDelAlumno.js";

const PUNTOS = [0, 1, 2, -3, 0.5, 7];

function lado(texto) {
  return lee(texto);
}

// Las soluciones de una ecuación de primer grado en x: un número,
// "identidad" (vale cualquier x) o "sin solución". null si no es de primer
// grado (entonces no se decide).
export function solucionLineal(izq, der) {
  const f = (x) => evalua(izq, { x }) - evalua(der, { x });
  const b = f(0);
  const a = f(1) - b;
  for (const x of PUNTOS) if (!casiIgual(f(x), a * x + b, 1e-7)) return null;
  const escala = Math.max(Math.abs(a), Math.abs(b), 1);
  if (Math.abs(a) < 1e-9 * escala) return Math.abs(b) < 1e-9 * escala ? "identidad" : "sin solución";
  return -b / a;
}

const mismaSolucion = (s, t) => (typeof s === "number" && typeof t === "number" ? casiIgual(s, t, 1e-7) : s === t);

export function leeEcuacion(texto) {
  const partes = normaliza(texto).split("=");
  if (partes.length !== 2 || !partes[0] || !partes[1]) throw new Error("una ecuación lleva un solo «=»");
  const izq = lado(partes[0]);
  const der = lado(partes[1]);
  for (const v of [...variables(izq), ...variables(der)]) if (v !== "x") throw new Error(`letra inesperada: ${v}`);
  return { izq, der, solucion: solucionLineal(izq, der) };
}

export function leeExpresion(texto) {
  const t = normaliza(texto);
  if (t.includes("=")) {
    // «2x − 8 = 2x − 8»: en reducir, muchos escriben el resultado tras un igual.
    const ultimo = t.split("=").pop();
    if (!ultimo) throw new Error("falta lo que va después del «=»");
    return { arbol: lado(ultimo) };
  }
  return { arbol: lado(t) };
}

function equivalenteExpresion(arbol, referencia) {
  return PUNTOS.every((x) => casiIgual(evalua(arbol, { x }), evalua(referencia, { x }), 1e-7));
}

// referencia: { tipo: "ecuacion", ecuacion } | { tipo: "expresion", expresion }
// lineas: textos tal como los escribió el alumno (o como se leyeron de la foto).
export function comprobarLineas({ referencia, lineas }) {
  const ref = referencia.tipo === "ecuacion" ? leeEcuacion(referencia.ecuacion) : leeExpresion(referencia.expresion);
  const resultado = lineas.map((texto) => {
    try {
      if (referencia.tipo === "ecuacion") {
        const l = leeEcuacion(texto);
        const equivalente = l.solucion === null ? null : mismaSolucion(l.solucion, ref.solucion);
        return { texto, leida: true, equivalente, solucion: l.solucion, arbol: { izq: l.izq, der: l.der } };
      }
      const l = leeExpresion(texto);
      return { texto, leida: true, equivalente: equivalenteExpresion(l.arbol, ref.arbol), arbol: l.arbol };
    } catch (e) {
      return { texto, leida: false, equivalente: null, motivo: e.message };
    }
  });
  const primeraMal = resultado.findIndex((r) => r.equivalente === false);
  return { lineas: resultado, primeraMal: primeraMal === -1 ? null : primeraMal, solucionDelEnunciado: ref.solucion ?? null };
}
