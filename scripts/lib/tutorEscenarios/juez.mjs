// EL JUEZ: otra llamada a la IA que puntúa la respuesta del tutor.
//
// Lo que no se puede contar con un programa (¿le ha pedido el razonamiento?,
// ¿el lenguaje es de un niño de 9 años?) lo valora un modelo con la rúbrica
// de LearnLM (claude/investigacion-learnlm.md): carga cognitiva, aprendizaje
// activo, metacognición, curiosidad y adaptación, de 1 a 5, más si ha hecho
// lo que el escenario pide.
//
// LÍMITE, dicho claro: es una IA corrigiendo a otra. Sirve para comparar
// versiones del prompt entre sí y para cazar respuestas claramente malas; no
// sustituye a que un profesor lea conversaciones. Por eso lo que más importa
// (no regalar la solución) no lo decide el juez sino comprobaciones.mjs.
//
// Se usa un modelo distinto y más capaz que el del tutor (Opus), a
// temperatura 0, para que no se corrija a sí mismo con sus propios sesgos.

export const DIMENSIONES = ["carga", "activo", "metacognicion", "curiosidad", "adaptacion"];

export function promptDelJuez(esc, reply) {
  const hilo = (esc.historial || []).map((m) => `${m.role === "user" ? "ALUMNO" : "TUTOR"}: ${m.content}`).join("\n");
  return `Eres un profesor experto en pedagogía que evalúa a un tutor de IA para alumnos españoles.

CONTEXTO
Alumno de ${esc.alumno?.nivel_educativo || "nivel desconocido"}, asignatura ${esc.alumno?.asignatura || "desconocida"}.
Ejercicio: ${esc.documentText || "(sin enunciado)"}
${hilo ? `Conversación hasta ahora:\n${hilo}\n` : ""}ALUMNO (último mensaje): ${esc.texto}

RESPUESTA DEL TUTOR
${reply}

LO QUE DEBERÍA HACER UN BUEN TUTOR AQUÍ
${esc.debe}

Puntúa de 1 (muy mal) a 5 (excelente):
- carga: longitud y claridad apropiadas, sin sobrecargar.
- activo: deja que el alumno haga el trabajo; no regala la respuesta.
- metacognicion: le ayuda a descubrir su propio error o razonamiento.
- curiosidad: mantiene el interés sin forzarlo.
- adaptacion: vocabulario y ayuda ajustados a su nivel y a lo que ha pasado.
Y di si cumple lo que debería hacer (cumple: true/false).

Contesta SOLO con un JSON, sin texto alrededor:
{"carga":n,"activo":n,"metacognicion":n,"curiosidad":n,"adaptacion":n,"cumple":true|false,"motivo":"una frase"}`;
}

// El modelo a veces envuelve el JSON en ```; se busca el primer objeto.
export function leerVeredicto(texto) {
  const m = String(texto || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let v;
  try { v = JSON.parse(m[0]); } catch { return null; }
  const notas = {};
  for (const d of DIMENSIONES) {
    const n = Number(v[d]);
    if (!Number.isFinite(n) || n < 1 || n > 5) return null;
    notas[d] = n;
  }
  if (typeof v.cumple !== "boolean") return null;
  return { notas, cumple: v.cumple, motivo: String(v.motivo || "").slice(0, 300) };
}

// `preguntar(prompt)` devuelve el texto del modelo: inyectado para poder
// probar sin llamar a la API.
export async function juzgar(esc, reply, preguntar) {
  const texto = await preguntar(promptDelJuez(esc, reply));
  return leerVeredicto(texto);
}
