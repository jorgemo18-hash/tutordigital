// LA FICHA DE UNA TAREA QUE SALE DE NUESTRA HOJA, SIN IA (2/10/2026).
//
// Si la tarea se creó con «Poner como deberes» (tasks.hoja_id, migración
// 131), la hoja guardada ya dice qué ejercicios lleva, de qué tipo es cada
// uno (la clave de su batería), y por apartado la solución, las
// respuestas-trampa y el texto plano. No hace falta que Opus lea el PDF:
// los pasos salen del método del tipo (tutor/metodos/).
import { metodoDe } from "../metodos/catalogo.js";
import { referenciaDelApartado } from "../comprobador/referencias.js";

// Una hoja guardada → [{ index, clave, nombre, metodo, apartados }]. Los
// apartados van SIN el ejemplo resuelto (el alumno no lo contesta), con su
// letra según el orden de la hoja.
export function actividadesDeLaHoja({ temaId, huecos }) {
  return (huecos || []).map((h, i) => {
    const apartados = (h.respuestas || []).filter((r) => !r.ejemplo).map((r) => ({
      texto: r.texto || null,
      solucion: r.solucion,
      trampas: (r.trampas || []).map((t) => ({ error: t.error, respuesta: t.respuesta, solucion: Number(t.respuesta) })),
      referencia: r.texto ? referenciaDelApartado(h.clave, r.texto) : null,
    }));
    return { index: i + 1, clave: h.clave, nombre: h.nombre || `Ejercicio ${i + 1}`, metodo: metodoDe({ tema: temaId, clave: h.clave }), apartados };
  });
}

// Lo que necesita la sesión al empezar: ejercicios para elegir y, si solo
// hay uno, sus pasos (los hitos de su método, con título neutro).
export function pasosDelMetodo(metodo) {
  return (metodo?.hitos || []).map((h, i) => ({ index: i, title: h.alumno, completed: false, id: h.id }));
}

export async function hojaDeLaTarea(admin, { tenantId, taskId }) {
  try {
    const { data: tarea } = await admin.from("tasks").select("hoja_id").eq("id", taskId).eq("tenant_id", tenantId).maybeSingle();
    if (!tarea?.hoja_id) return null;
    const { data: hoja } = await admin.from("contenido_hojas").select("id, tema_id, huecos")
      .eq("id", tarea.hoja_id).eq("tenant_id", tenantId).maybeSingle();
    if (!hoja?.huecos?.length) return null;
    return { hojaId: hoja.id, temaId: hoja.tema_id, actividades: actividadesDeLaHoja({ temaId: hoja.tema_id, huecos: hoja.huecos }) };
  } catch {
    return null;
  }
}

// El enunciado para el prompt del tutor, en texto: mejor que el PDF (es
// exactamente lo que se imprimió, sin OCR).
export function textoDeLaHoja(hoja) {
  return hoja.actividades.map((a) => {
    const apartados = a.apartados.filter((x) => x.texto).map((x, i) => `  ${"abcdefgh"[i]}) ${x.texto}`);
    return apartados.length ? `Ejercicio ${a.index}: ${a.nombre}\n${apartados.join("\n")}` : `Ejercicio ${a.index}: ${a.nombre}`;
  }).join("\n\n");
}

// Solo si TODOS sus ejercicios tienen método (hoy, Álgebra de 1.º ESO): si
// no, la sesión sigue el camino de siempre (la guía lee el PDF), para no
// quedarse sin pasos en los temas que aún no tienen método.
export function hojaConMetodo(hoja) {
  return Boolean(hoja?.actividades?.length) && hoja.actividades.every((a) => a.metodo);
}

// Lo mismo que devuelve analizarConFicha (orchestrator/analisisConFicha.js),
// sin IA.
export function analisisDeLaHoja(hoja) {
  const exercises = hoja.actividades.map((a) => ({ index: a.index, title: a.nombre }));
  const unico = hoja.actividades.length === 1 ? hoja.actividades[0] : null;
  return {
    exercises,
    documentText: textoDeLaHoja(hoja),
    needsChoice: !unico,
    steps: unico ? pasosDelMetodo(unico.metodo) : [],
    guideOk: unico ? true : null,
    usageEvents: [],
    deHoja: true,
  };
}
