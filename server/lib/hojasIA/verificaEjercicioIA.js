import { z } from "zod";
import { comprueba } from "../verificador/comprobaciones.js";
import { lee, evalua } from "../verificador/expresionDeTexto.js";

// UN EJERCICIO ESCRITO POR LA IA, ANTES DE LLEGAR A LA HOJA:
//   1. tiene la forma que se pidió (si no, fuera);
//   2. su saber es de los del tema (si no, fuera: no se sale del currículo);
//   3. no es una copia de un ejercicio de referencia (si lo es, fuera);
//   4. cada `comprobar` cuadra (si uno no cuadra, fuera: una solución mal es
//      peor que un ejercicio menos) y la solución escrita dice lo mismo;
//   5. si no trae `comprobar`, pasa como "sin_verificar", y se dice.
// Devuelve { ejercicio } o { descarte: motivo }.
const EjercicioIA = z.object({
  tipo: z.enum(["ejercicio", "problema"]),
  subtipo: z.string().trim().min(1).max(80),
  dificultad: z.number().int().min(1).max(3),
  saber: z.string().trim().max(10),
  enunciado: z.string().trim().min(1).max(1500),
  apartados: z.array(z.string().trim().min(1).max(400)).max(8).optional(),
  solucion: z.string().trim().min(1).max(2000),
  comprobar: z.array(z.object({ tipo: z.string() }).passthrough()).max(12).optional(),
}).passthrough();

// Para comparar textos sin que cuenten espacios, dólares ni mayúsculas.
const plano = (t) => String(t || "").toLowerCase().replace(/[\s$\\{}]/g, "");

export function huellasDeReferencias(referencias) {
  const textos = new Set();
  const cuentas = new Set();
  for (const r of referencias) {
    textos.add(plano(r.enunciado));
    for (const c of r.comprobar || []) for (const x of [c.ecuacion, c.expresion, ...(c.ecuaciones || [])]) if (x) cuentas.add(plano(x));
  }
  return { textos, cuentas };
}

// ¿Dice la solución escrita el resultado calculado? "x = 3/2" vale como
// "3/2", "\frac{3}{2}", "1,5" o "1.5".
export function solucionDice(solucion, respuesta) {
  const t = String(solucion).replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2").replace(/\{,\}/g, ",").replace(/[\s$]/g, "").replace(/,/g, ".");
  const formas = new Set([String(respuesta).replace(/\s/g, "")]);
  try {
    const v = evalua(lee(String(respuesta)));
    if (Number.isFinite(v)) {
      if (Number.isInteger(v)) formas.add(String(v));
      else for (const d of [1, 2, 3]) formas.add(v.toFixed(d));
    }
  } catch { /* una respuesta que no es un número: se busca tal cual */ }
  return [...formas].some((f) => t.includes(f));
}

export function verificaEjercicioIA(bruto, { saberesDelTema, huellas }) {
  const p = EjercicioIA.safeParse(bruto);
  if (!p.success) return { descarte: "no tiene la forma pedida" };
  const e = p.data;
  if (!saberesDelTema.includes(e.saber)) return { descarte: `saber ${e.saber} fuera del tema` };
  if (huellas.textos.has(plano(e.enunciado + (e.apartados || []).join("")))) return { descarte: "copia de un ejercicio de referencia" };
  const cuentas = (e.comprobar || []).flatMap((c) => [c.ecuacion, c.expresion, ...(c.ecuaciones || [])]).filter(Boolean);
  if (cuentas.some((x) => huellas.cuentas.has(plano(x)))) return { descarte: "repite una cuenta de un ejercicio de referencia" };
  for (const c of e.comprobar || []) {
    const r = comprueba(c);
    if (!r.ok) return { descarte: `comprobación ${c.apartado || ""} no cuadra: ${r.motivo}` };
    const valores = Array.isArray(c.respuesta) ? c.respuesta : typeof c.respuesta === "string" && c.tipo !== "igualdad" ? [c.respuesta] : [];
    const falta = valores.find((v) => !["sin solución", "identidad", "infinitas"].includes(v) && !solucionDice(e.solucion, v));
    if (falta !== undefined) return { descarte: `la solución escrita no dice ${falta}` };
  }
  return { ejercicio: { ...e, verificacion: e.comprobar?.length ? "comprobada" : "sin_verificar" } };
}
