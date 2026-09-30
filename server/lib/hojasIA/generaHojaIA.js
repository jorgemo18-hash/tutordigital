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

// Una llamada a la IA y la verificación de lo que devuelve.
async function unaRonda({ client, model, ctx, pide, dificultad, yaHay, verifica }) {
  const respuesta = await client.messages.create({
    model,
    max_tokens: 8000,
    system: promptDeHojaIA(ctx),
    tools: [{ name: HERRAMIENTA, description: "Escribe los ejercicios de la hoja.", input_schema: ESQUEMA }],
    tool_choice: { type: "tool", name: HERRAMIENTA },
    messages: [{ role: "user", content: mensajeDeHojaIA({ ...ctx, cuantos: pide, dificultad, yaHay }) }],
  });
  const bloque = (respuesta.content || []).find((b) => b.type === "tool_use" && b.name === HERRAMIENTA);
  const brutos = Array.isArray(bloque?.input?.ejercicios) ? bloque.input.ejercicios : [];
  const buenos = [];
  const descartes = [];
  for (const b of brutos) {
    const r = verifica(b);
    const enunciado = String(b?.enunciado || "").slice(0, 120);
    if (r.ejercicio) buenos.push(r.ejercicio);
    else descartes.push({ enunciado, motivo: r.descarte });
    for (const q of r.apartadosQuitados || []) descartes.push({ enunciado, motivo: `apartado quitado: ${q}`, soloApartado: true });
  }
  return { buenos, descartes, usage: respuesta.usage || {} };
}

const suma = (a, b) => ({ input_tokens: (a.input_tokens || 0) + (b.input_tokens || 0), output_tokens: (a.output_tokens || 0) + (b.output_tokens || 0) });

// Si tras la primera llamada faltan ejercicios, UNA segunda llamada pide los
// que faltan (más DE_MAS), diciendo qué tipos ya hay para que no los repita.
// Solo una: si la segunda también falla, mejor una hoja más corta que un
// bucle que gasta sin límite.
export async function generaHojaIA({ client, model, etapa, materia, curso, tema, cuantos = 6, dificultad = null }) {
  const ctx = contextoDelTema({ etapa, materia, curso, tema });
  if (!ctx) return null;
  const huellas = huellasDeReferencias(ctx.todasLasReferencias);
  const saberesDelTema = ctx.saberes.map((s) => s.codigo);
  const verifica = (b) => verificaEjercicioIA(b, { saberesDelTema, huellas });
  const r1 = await unaRonda({ client, model, ctx, pide: cuantos + DE_MAS, dificultad, yaHay: [], verifica });
  let { buenos, descartes, usage } = r1;
  const faltan = cuantos - buenos.length;
  if (faltan > 0) {
    const r2 = await unaRonda({ client, model, ctx, pide: faltan + DE_MAS, dificultad, yaHay: buenos.map((e) => e.subtipo), verifica });
    buenos = [...buenos, ...r2.buenos];
    descartes = [...descartes, ...r2.descartes];
    usage = suma(usage, r2.usage);
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
    usage,
  };
}
