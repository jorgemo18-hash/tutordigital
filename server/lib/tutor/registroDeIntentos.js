// LO QUE QUEDA DE CADA ENVÍO COMPROBADO (migración 152, tutor_intentos), y
// lo que se lee de la base para el veredicto: los fallos previos en el
// mismo paso y el nombre de los errores del catálogo.
//
// Igual que el resto del tutor: si la base falla, el alumno sigue teniendo
// respuesta (se avisa a Sentry y se sigue con peldaño 1).
import { Sentry } from "../sentry.js";
import { TEMAS_CON_GENERADOR } from "../generadorEjercicios/temasConGenerador.js";

// Los envíos anteriores de esta sesión en este ejercicio: cuántas veces ha
// fallado cada paso de cada apartado (el peldaño de la escalera) y qué
// apartados ya ha terminado bien.
export async function intentosPrevios(admin, { sessionId, actividad }) {
  try {
    const { data, error } = await admin.from("tutor_intentos").select("apartado, hito_mal, todo_hecho, created_at")
      .eq("session_id", sessionId).eq("actividad", actividad);
    if (error) throw error;
    const filas = data || [];
    return {
      fallos: (apartado, hitoId) => filas.filter((f) => f.apartado === apartado && f.hito_mal === hitoId).length,
      apartadosHechos: new Set(filas.filter((f) => f.todo_hecho).map((f) => f.apartado)),
      abierto: ultimoAbierto(filas),
    };
  } catch (e) {
    Sentry.captureException(e, { extra: { operation: "tutor_intentos_leer", sessionId } });
    return { fallos: () => 0, apartadosHechos: new Set(), abierto: null };
  }
}

// El apartado del último envío, si no lo terminó: lo normal es que siga con él.
function ultimoAbierto(filas) {
  const ultimo = [...filas].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).pop();
  return ultimo && !ultimo.todo_hecho ? ultimo.apartado : null;
}

// Los errores del catálogo del tema, por su número: { nombre, descripcion }.
export async function erroresDelTema(admin, { temaId }) {
  const tema = TEMAS_CON_GENERADOR.find((t) => t.id === temaId);
  if (!tema) return new Map();
  const idDe = (n) => tema.idDeConcepto(n).replace(/^c1/, "c2");
  const ids = Array.from({ length: 30 }, (_, i) => idDe(i + 1));
  try {
    const { data } = await admin.from("contenido_errores_tipo").select("id, nombre, descripcion").in("id", ids);
    return new Map((data || []).map((f) => [ids.indexOf(f.id) + 1, { nombre: f.nombre, descripcion: f.descripcion }]));
  } catch {
    return new Map();
  }
}

export async function guardarIntento(admin, { tenantId, sessionId, hojaId, actividad, clave, v }) {
  try {
    const { error } = await admin.from("tutor_intentos").insert({
      tenant_id: tenantId, session_id: sessionId, hoja_id: hojaId || null,
      actividad, apartado: v.apartado, clave,
      lineas: v.comprobacion.lineas.map((l) => ({ texto: l.texto, leida: l.leida, equivalente: l.equivalente })),
      primera_mal: v.comprobacion.primeraMal, hito_mal: v.hitoMal, error_numero: v.errorProbable?.error ?? null,
      nivel: v.nivel, todo_hecho: v.todoHecho,
    });
    if (error) throw error;
  } catch (e) {
    Sentry.captureException(e, { extra: { operation: "tutor_intentos_guardar", sessionId } });
  }
}
