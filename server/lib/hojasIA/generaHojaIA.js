import { contextoDelTema } from "./contextoDelTema.js";
import { HERRAMIENTA, ESQUEMA, promptDeHojaIA, mensajeDeHojaIA } from "./promptDeHojaIA.js";
import { verificaEjercicioIA, huellasDeReferencias } from "./verificaEjercicioIA.js";

// UNA HOJA ESCRITA POR LA IA para un tema con ejercicios de referencia y sin
// generador propio. Devuelve la hoja con la MISMA forma que la del generador
// (la pinta la misma plantilla) y los huecos con lo que no se imprime: la
// solución, cómo se comprobó y el saber.
//
// Se piden dos ejercicios de más: alguno puede no pasar la comprobación, y
// una hoja con dos menos de los pedidos se nota más que dos de sobra.
export const DE_MAS = 2;

export async function generaHojaIA({ client, model, etapa, materia, curso, tema, cuantos = 6, dificultad = null }) {
  const ctx = contextoDelTema({ etapa, materia, curso, tema });
  if (!ctx) return null;
  const respuesta = await client.messages.create({
    model,
    max_tokens: 8000,
    system: promptDeHojaIA(ctx),
    tools: [{ name: HERRAMIENTA, description: "Escribe los ejercicios de la hoja.", input_schema: ESQUEMA }],
    tool_choice: { type: "tool", name: HERRAMIENTA },
    messages: [{ role: "user", content: mensajeDeHojaIA({ ...ctx, cuantos: cuantos + DE_MAS, dificultad }) }],
  });
  const bloque = (respuesta.content || []).find((b) => b.type === "tool_use" && b.name === HERRAMIENTA);
  const brutos = Array.isArray(bloque?.input?.ejercicios) ? bloque.input.ejercicios : [];
  const huellas = huellasDeReferencias(ctx.todasLasReferencias);
  const saberesDelTema = ctx.saberes.map((s) => s.codigo);
  const buenos = [];
  const descartes = [];
  for (const b of brutos) {
    const r = verificaEjercicioIA(b, { saberesDelTema, huellas });
    if (r.ejercicio) buenos.push(r.ejercicio);
    else descartes.push({ enunciado: String(b?.enunciado || "").slice(0, 120), motivo: r.descarte });
  }
  // Los comprobados primero al elegir (a igualdad, el orden de la IA), y
  // luego de menos a más difícil, como pide una hoja.
  const elegidos = [...buenos]
    .sort((a, b) => (a.verificacion === "comprobada" ? 0 : 1) - (b.verificacion === "comprobada" ? 0 : 1))
    .slice(0, cuantos)
    .sort((a, b) => a.dificultad - b.dificultad);
  const saberDe = (codigo) => ctx.saberes.find((s) => s.codigo === codigo);
  return {
    hoja: {
      materia: ctx.materia,
      curso: ctx.curso,
      tema: ctx.tema,
      objetivo: "",
      ejemplos: [],
      actividades: elegidos.map((e) => ({
        enunciado: e.enunciado,
        tipo: e.tipo,
        dificultad: e.dificultad,
        ...(e.apartados?.length ? { apartados: e.apartados } : {}),
        ...(e.tipo === "problema" ? { lineas: 4 } : {}),
      })),
    },
    huecos: elegidos.map((e, i) => ({
      orden: i + 1,
      nombre: e.subtipo,
      dificultad: e.dificultad,
      saber: { codigo: e.saber, nombre: saberDe(e.saber)?.nombre || "" },
      verificacion: e.verificacion,
      solucion: e.solucion,
      comprobar: e.comprobar || [],
    })),
    descartes,
    usage: respuesta.usage,
  };
}
