import { z } from "zod";
import { comprueba } from "../verificador/comprobaciones.js";
import { lee, evalua } from "../verificador/expresionDeTexto.js";
import { solucionDeApartados, unaComprobacionPorApartado, sinApartados } from "./solucionDeApartados.js";
import { seCorrigeDentro, respuestaTrivial } from "./enunciadoSospechoso.js";

// UN EJERCICIO ESCRITO POR LA IA, ANTES DE LLEGAR A LA HOJA:
//   1. tiene la forma que se pidió (si no, fuera);
//   2. su saber es de los del tema (si no, fuera: no se sale del currículo);
//   3. no es una copia de un ejercicio de referencia (si lo es, fuera);
//   4. cada `comprobar` cuadra. En un ejercicio de técnica con una
//      comprobación por apartado, el apartado que no cuadra (o que repite una
//      cuenta de referencia) se QUITA y la solución la escribe el código
//      (solucionDeApartados.js); si no queda ninguno, fuera. En lo demás
//      (problemas…), uno que no cuadra tira el ejercicio, y la solución
//      escrita por la IA tiene que decir lo que sale;
//   5. si no trae `comprobar`, pasa como "sin_verificar", y se dice;
//   6. fuera también si la IA se corrige dentro del enunciado o si un
//      problema tiene por respuesta 0 (enunciadoSospechoso.js).
// Devuelve { ejercicio } o { descarte: motivo }.
const EjercicioIA = z.object({
  tipo: z.enum(["ejercicio", "problema"]),
  subtipo: z.string().trim().min(1).max(80),
  dificultad: z.number().int().min(1).max(3),
  saber: z.string().trim().min(1).max(30),
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

// Los resultados de una comprobación que una solución escrita tiene que decir.
// Una igualdad no (la expresión simplificada se puede escribir de mil formas).
function valoresDe(c) {
  const r = c.respuesta;
  const valores = Array.isArray(r) ? r
    : r && typeof r === "object" ? Object.values(r)
      : (typeof r === "string" || typeof r === "number") && c.tipo !== "igualdad" ? [r] : [];
  return valores.filter((v) => !["sin solución", "identidad", "infinitas"].includes(v));
}

// SOLO ENTEROS, si el profesor lo pide (Jorge, 1/10/2026: «depende del tema,
// normalmente se trabaja más con fracciones»). Por eso no es la regla por
// defecto: en la hoja se elige. Un resultado que no es entero se trata como
// uno que no cuadra: el apartado se quita (el problema entero, fuera).
export function noEsEntero(c) {
  return valoresDe(c).some((v) => {
    try {
      const x = evalua(lee(String(v)));
      return !Number.isFinite(x) || Math.abs(x - Math.round(x)) > 1e-9;
    } catch {
      return false; // lo que no es un número (una expresión simplificada) no se juzga aquí
    }
  });
}

export function verificaEjercicioIA(bruto, { saberesDelTema, huellas, soloEnteros = false }) {
  const p = EjercicioIA.safeParse(bruto);
  if (!p.success) return { descarte: "no tiene la forma pedida" };
  // La IA a veces pone dos códigos («D.2, D.4»): vale si todos son del tema,
  // y se queda el primero (la hoja enseña un saber por ejercicio).
  const codigos = p.data.saber.split(/[\s,;]+/).filter((c) => c && c !== "y");
  if (!codigos.length || !codigos.every((c) => saberesDelTema.includes(c))) return { descarte: `saber ${p.data.saber} fuera del tema` };
  const e = { ...p.data, saber: codigos[0] };
  if (seCorrigeDentro([e.enunciado, ...(e.apartados || [])].join(" "))) return { descarte: "la IA se corrige dentro del enunciado" };
  if (e.tipo === "problema" && respuestaTrivial(e.comprobar)) return { descarte: "problema con respuesta 0: no tiene sentido como problema" };
  if (huellas.textos.has(plano(e.enunciado + (e.apartados || []).join("")))) return { descarte: "copia de un ejercicio de referencia" };
  const repetida = (c) => [c.ecuacion, c.expresion, ...(c.ecuaciones || [])].filter(Boolean).some((x) => huellas.cuentas.has(plano(x)));
  if (unaComprobacionPorApartado(e)) {
    const malos = new Set();
    const motivos = [];
    e.comprobar.forEach((c, i) => {
      let r = repetida(c) ? { ok: false, motivo: "repite una cuenta de referencia" } : comprueba(c);
      if (r.ok && soloEnteros && noEsEntero(c)) r = { ok: false, motivo: "el resultado no es entero" };
      if (!r.ok) { malos.add(i); motivos.push(`${c.apartado}) ${r.motivo}`); }
    });
    if (malos.size === e.apartados.length) return { descarte: `ningún apartado cuadra: ${motivos.join("; ")}` };
    const limpio = malos.size ? sinApartados(e, malos) : e;
    // La solución de la IA se queda si no se ha quitado nada y dice todos los
    // resultados comprobados: lleva las unidades y los pasos («100 000 litros»),
    // que la del código no sabe poner. Si no, la escribe el código.
    const suyaVale = !malos.size && limpio.comprobar.every((c) => valoresDe(c).every((v) => solucionDice(e.solucion, v)));
    return {
      ejercicio: { ...limpio, solucion: suyaVale ? e.solucion : solucionDeApartados(limpio.comprobar), verificacion: "comprobada" },
      apartadosQuitados: motivos,
    };
  }
  if ((e.comprobar || []).some(repetida)) return { descarte: "repite una cuenta de un ejercicio de referencia" };
  if (soloEnteros && (e.comprobar || []).some(noEsEntero)) return { descarte: "el resultado no es entero" };
  for (const c of e.comprobar || []) {
    const r = comprueba(c);
    if (!r.ok) return { descarte: `comprobación ${c.apartado || ""} no cuadra: ${r.motivo}` };
    const falta = valoresDe(c).find((v) => !solucionDice(e.solucion, v));
    if (falta !== undefined) return { descarte: `la solución escrita no dice ${falta}` };
  }
  return { ejercicio: { ...e, verificacion: e.comprobar?.length ? "comprobada" : "sin_verificar" } };
}
