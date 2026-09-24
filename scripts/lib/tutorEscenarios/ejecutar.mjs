// PASA CADA ESCENARIO POR EL TUTOR VARIAS VECES Y JUNTA LOS RESULTADOS.
//
// Varias veces porque la IA no contesta igual dos veces: un escenario que
// sale bien 1 de 3 no está bien. Las dependencias (el tutor y el juez)
// entran como funciones para poder probar esto sin gastar llamadas.
import { datosDeLlamada } from "./escenarios.mjs";
import { comprobar } from "./comprobaciones.mjs";
import { juzgar, DIMENSIONES } from "./juez.mjs";

export async function ejecutarEscenario(esc, { tutor, preguntarAlJuez, veces = 3 }) {
  const intentos = [];
  for (let i = 0; i < veces; i++) {
    const r = await tutor(datosDeLlamada(esc));
    if (!r?.ok) {
      intentos.push({ error: r?.code || "error", reply: "", reglas: { ok: false, fallos: [{ regla: "contesta", detalle: r?.message || "sin respuesta" }] }, juez: null });
      continue;
    }
    const reglas = comprobar(esc, r.data);
    const juez = preguntarAlJuez ? await juzgar(esc, r.data.reply, preguntarAlJuez).catch(() => null) : null;
    intentos.push({ reply: r.data.reply, reglas, juez });
  }
  return resumirEscenario(esc, intentos);
}

export function resumirEscenario(esc, intentos) {
  const bien = intentos.filter((t) => t.reglas.ok && (t.juez ? t.juez.cumple : true)).length;
  const juzgados = intentos.filter((t) => t.juez);
  const media = {};
  for (const d of DIMENSIONES) {
    media[d] = juzgados.length ? juzgados.reduce((s, t) => s + t.juez.notas[d], 0) / juzgados.length : null;
  }
  return { id: esc.id, que: esc.que, veces: intentos.length, bien, media, intentos };
}

export async function ejecutarTodos(escenarios, deps, alAvanzar = () => {}) {
  const resultados = [];
  for (const esc of escenarios) {
    const r = await ejecutarEscenario(esc, deps);
    resultados.push(r);
    alAvanzar(r);
  }
  return resultados;
}
