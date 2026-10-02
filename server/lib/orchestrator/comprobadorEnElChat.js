// EL COMPROBADOR DENTRO DEL CHAT (2/10/2026): antes y después de la IA.
//
// Antes: si la tarea sale de nuestra hoja y el ejercicio es de los que el
// código sabe comprobar, se calcula el veredicto del mensaje (tutor/
// veredicto.js) y se le pasa a la IA como un hecho, con el peldaño de la
// escalera (tutor/escalera.js).
//
// Después: los pasos los marca el CÓDIGO, no la IA. En un ejercicio
// comprobable se ignora el [PASO_COMPLETADO] del modelo (el fallo del 1/10:
// dio por bueno un signo mal). Se guarda el intento (migración 152) y, en el
// peldaño 4, se avisa a la profe desde el servidor.
import { hojaDeLaTarea } from "../tutor/hoja/fichaDeHoja.js";
import { ejemploParecido } from "../tutor/hoja/ejemploParecido.js";
import { comprobarMensaje } from "../tutor/veredicto.js";
import { instruccionesParaElTutor, PELDANOS } from "../tutor/escalera.js";
import { intentosPrevios, erroresDelTema, guardarIntento } from "../tutor/registroDeIntentos.js";

export async function prepararVeredicto({ admin, tenantId, sessionId, taskId, exerciseIndex, texto }, deps = {}) {
  const cargarHoja = deps.hojaDeLaTarea || hojaDeLaTarea;
  const hoja = taskId ? await cargarHoja(admin, { tenantId, taskId }) : null;
  if (!hoja) return null;
  const actividad = hoja.actividades.find((a) => a.index === exerciseIndex) || (hoja.actividades.length === 1 ? hoja.actividades[0] : null);
  if (!actividad) return null;
  const comprobable = Boolean(actividad.metodo) && actividad.apartados.some((a) => a.referencia);
  if (!comprobable) return { hoja, actividad, comprobable: false, v: null, instrucciones: "" };

  const [previos, errores] = await Promise.all([
    intentosPrevios(admin, { sessionId, actividad: actividad.index }),
    erroresDelTema(admin, { temaId: hoja.temaId }),
  ]);
  const v = comprobarMensaje({
    texto, actividad, fallosPrevios: previos.fallos, abierto: previos.abierto,
    describirError: (n) => errores.get(n) || null,
    ejemplo: (distintoDe) => ejemploParecido({ temaId: hoja.temaId, clave: actividad.clave, distintoDe, semilla: `${sessionId}-${actividad.index}` }),
  });
  const instrucciones = v.estado === "comprobado" || v.estado === "apartado_desconocido" ? instruccionesParaElTutor(v) : "";
  return { hoja, actividad, comprobable: true, v, instrucciones, apartadosHechos: previos.apartadosHechos };
}

export function pasosSegunVeredicto(v, metodo) {
  const steps = metodo.hitos.map((h, i) => ({ index: i, id: h.id, title: h.alumno, completed: v.hitos[i]?.estado === "hecho" }));
  const pendiente = steps.findIndex((s) => !s.completed);
  return { steps, currentStep: pendiente === -1 ? steps.length - 1 : pendiente, allCompleted: pendiente === -1 };
}

// Devuelve null si no había veredicto; si no, el mapa de pasos nuevo, cuántos
// pasos ha avanzado respecto al anterior y un resumen para la pantalla.
export async function aplicarVeredicto({ admin, tenantId, sessionId, prep, pasosAntes = [] }) {
  const v = prep?.v;
  if (!v || v.estado !== "comprobado") return null;
  const { actividad, hoja } = prep;

  await guardarIntento(admin, { tenantId, sessionId, hojaId: hoja.hojaId, actividad: actividad.index, clave: actividad.clave, v });

  const mapa = pasosSegunVeredicto(v, actividad.metodo);
  // «Has completado todos los pasos de este ejercicio» solo cuando están
  // TODOS sus apartados, no al acabar el primero.
  const hechos = new Set([...(prep.apartadosHechos || []), ...(v.todoHecho ? [v.apartado] : [])]);
  mapa.allCompleted = mapa.allCompleted && actividad.apartados.every((_, i) => hechos.has(i));
  const hechosAntes = pasosAntes.filter((s) => s.completed).length;
  const avance = Math.max(0, mapa.steps.filter((s) => s.completed).length - hechosAntes);
  await admin.from("tutor_session_maps").update({ steps: mapa.steps, current_step: mapa.currentStep }).eq("session_id", sessionId);

  const escalado = v.nivel === PELDANOS;
  if (escalado) {
    await admin.from("tutor_sessions").update({
      needs_help: true,
      outcome: "escalated",
      escalation_reason: `Ejercicio ${actividad.index}, apartado ${"abcdefgh"[v.apartado]}): no lo ha sacado tras tres ayudas (pista, pista del error y ejemplo).`,
    }).eq("id", sessionId);
  }

  return {
    stepMap: mapa,
    avance,
    resumen: {
      apartado: v.apartado,
      hitos: v.hitos.map((h, i) => ({ titulo: actividad.metodo.hitos[i]?.alumno, estado: h.estado })),
      lineas: v.comprobacion.lineas.map((l) => ({ texto: l.texto, estado: !l.leida || l.equivalente === null ? "duda" : l.equivalente ? "bien" : "mal" })),
      nivel: v.nivel,
      todoHecho: v.todoHecho,
      escalado,
    },
  };
}

// CUÁNTOS PASOS CUENTAN EN ESTE MENSAJE. En un ejercicio comprobable, los
// del código (aunque la IA diga [PASO_COMPLETADO]); si no, los de la IA,
// como siempre.
export function pasosQueCuentan({ veredicto, aplicado, pasosDeLaIA }) {
  return veredicto?.comprobable ? (aplicado?.avance ?? 0) : (pasosDeLaIA ?? 0);
}
