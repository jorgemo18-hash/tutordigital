import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { resolverAlumnoIdsVisibles } from "../../lib/academiaProfesores/resolverAlumnosVisibles.js";
import { resolverBadgesSustitucion } from "../../lib/academiaProfesores/sustitucionBadge.js";
import { verificarAlumnoVisible } from "../../lib/academiaProfesores/verificarAlumnoVisible.js";
import { derivarSustitucionParaRegistro } from "../../lib/academiaSustituciones/derivarAutoria.js";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const FechaQuerySchema = z.object({ fecha: z.string().regex(FECHA_RE) });

const AsignaturaSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  tema: z.string().trim().max(500).optional().nullable(),
});

const SesionUpsertSchema = z.object({
  alumno_id: z.string().uuid(),
  fecha: z.string().regex(FECHA_RE),
  tipo: z.enum(["clase", "ausencia"]),
  asignatura: z.string().trim().max(120).optional().nullable(),
  tema: z.string().trim().max(500).optional().nullable(),
  asignaturas: z.array(AsignaturaSchema).max(3).optional(),
  comentario: z.string().trim().max(2000).optional().nullable(),
  comentario_privado: z.string().trim().max(2000).optional().nullable(),
  motivo_ausencia: z.string().trim().max(500).optional().nullable(),
});

// Limpia bloques vacíos (el frontend permite añadir un bloque y no rellenarlo)
// y descarta asignaturas si la sesión es una ausencia.
function normalizarAsignaturas(asignaturas, tipo) {
  if (tipo === "ausencia") return [];
  return (asignaturas || []).filter((a) => a.nombre?.trim());
}

// dia_semana en academia_horario usa 1=lunes…5=viernes, igual que Date#getDay()
// para Mon–Fri (0=domingo, 6=sábado quedan fuera del check constraint).
export function diaSemanaFromFecha(fechaISO) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Se puede marcar una AUSENCIA anticipada (la familia avisa con
// antelación, ver diarioFechas.js#RANGO_DIAS_ADELANTE en el frontend) pero
// nunca registrar una CLASE en el futuro — no ha ocurrido todavía. El
// frontend ya no deja llegar hasta aquí en ese caso (buildClaseBodyFutura
// en diarioDrawerBody.js oculta el formulario y "Guardar"), pero la
// validación real vive aquí: nunca solo en el cliente.
export function esClaseFuturaNoPermitida(tipo, fechaISO, hoyISO = todayISO()) {
  return tipo !== "ausencia" && fechaISO > hoyISO;
}

// Combina los alumnos que tienen horario ese día con las sesiones ya
// registradas para esa fecha (incluye sesiones "extra" sin horario ese día).
export function mergeHorarioYSesiones(horarioRows, sesionRows) {
  const sesionByAlumno = new Map((sesionRows || []).map((s) => [s.alumno_id, s]));
  const vistos = new Set();
  const deHorario = [];

  for (const row of horarioRows || []) {
    const alumno = row.alumno;
    if (!alumno || alumno.activo === false) continue;
    if (vistos.has(alumno.id)) {
      const existente = deHorario.find((e) => e.alumno_id === alumno.id);
      existente?.horarios.push({ hora_inicio: row.hora_inicio, hora_fin: row.hora_fin });
      continue;
    }
    vistos.add(alumno.id);
    deHorario.push({
      alumno_id: alumno.id,
      nombre: alumno.nombre,
      curso: alumno.curso,
      nivel: alumno.nivel,
      horarios: [{ hora_inicio: row.hora_inicio, hora_fin: row.hora_fin }],
      origen: "horario",
      sesion: sesionByAlumno.get(alumno.id) || null,
    });
  }

  const extra = (sesionRows || [])
    .filter((s) => !vistos.has(s.alumno_id))
    .map((s) => ({
      alumno_id: s.alumno_id,
      nombre: s.alumno?.nombre,
      curso: s.alumno?.curso,
      nivel: s.alumno?.nivel,
      horarios: [],
      origen: "extra",
      sesion: s,
    }));

  deHorario.sort((a, b) => (a.horarios[0]?.hora_inicio || "").localeCompare(b.horarios[0]?.hora_inicio || ""));
  extra.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));
  return [...deHorario, ...extra];
}

// teacher_profiles no tiene columna tenant_id — solo tenant_slug (ver
// 014_admin_teacher_invites.sql) — filtrar por tenant_id nunca encontraba
// nada, bug preexistente detectado al auditar el flujo de invitación.
export async function findProfesorId(admin, tenantSlug, userId) {
  const { data } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("tenant_slug", tenantSlug)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id || null;
}

// Toda la lógica de "qué ve este usuario en el diario de un día" en una
// sola función, sin nada de Fastify — así el test de regresión de la
// regla de seguridad (profesor sin asignaciones -> [], nunca el tenant
// entero) cubre exactamente lo que corre en producción.
// No reenvía `hoyISO` a resolverAlumnoIdsVisibles (que sí lo soporta) — usa
// su reloj real por defecto. Bajo riesgo hoy porque ambos lados leen el
// reloj casi al mismo instante, pero es deuda pendiente: ver docs/deuda-tecnica.md.
export async function fetchDiarioVisible(admin, { tenantId, tenantSlug, userId, role, findProfesorIdFn, fecha, diaSemana }) {
  const { alumnoIds, sustitucionPorAlumnoId, error: visiblesErr } = await resolverAlumnoIdsVisibles(admin, {
    tenantId,
    tenantSlug,
    userId,
    role,
    findProfesorIdFn,
  });
  if (visiblesErr) return { error: visiblesErr };
  // Un profesor con alumnoIds:[] no tiene NINGUNA asignación — se lo
  // decimos explícitamente al frontend (sinAlumnosAsignados) para que
  // pueda distinguir "no tienes alumnos" de "hoy no hay clase" (algo que
  // pasa a diario con alumnos sí asignados), en vez de un "sin alumnos
  // con clase este día" engañoso.
  const sinAlumnosAsignados = alumnoIds !== null && alumnoIds.length === 0;
  // Regla de seguridad innegociable: sin ninguna asignación, lista vacía
  // — NUNCA cae a la consulta sin filtro de abajo (mismo antipatrón que
  // el bug de aislamiento de GET /api/v1/tasks).
  if (sinAlumnosAsignados) return { alumnos: [], sinAlumnosAsignados };

  let horarioQuery = admin
    .from("academia_horario")
    .select(
      "hora_inicio, hora_fin, fecha_inicio, fecha_fin, " +
        "alumno:academia_alumnos(id, nombre, curso, nivel, activo)"
    )
    .eq("tenant_id", tenantId)
    .eq("dia_semana", diaSemana)
    .lte("fecha_inicio", fecha)
    .or(`fecha_fin.is.null,fecha_fin.gte.${fecha}`);
  if (alumnoIds !== null) horarioQuery = horarioQuery.in("alumno_id", alumnoIds);

  let sesionesQuery = admin
    .from("academia_sesiones")
    .select(
      "id, alumno_id, fecha, hora, tipo, asignatura, tema, asignaturas, comentario, comentario_privado, motivo_ausencia, profesor_id, " +
        "alumno:academia_alumnos(id, nombre, curso, nivel)"
    )
    .eq("tenant_id", tenantId)
    .eq("fecha", fecha);
  if (alumnoIds !== null) sesionesQuery = sesionesQuery.in("alumno_id", alumnoIds);

  const [horarioRes, sesionesRes] = await Promise.all([horarioQuery, sesionesQuery]);
  if (horarioRes.error || sesionesRes.error) return { error: horarioRes.error || sesionesRes.error };

  const alumnos = mergeHorarioYSesiones(horarioRes.data, sesionesRes.data);
  // Misma marca "vía sustitución de X" que el horario (ver
  // resolverBadgesSustitucion) — nunca para un alumno con asignación
  // propia, solo para los que aparecen por cubrir a otro profesor hoy.
  const badges = await resolverBadgesSustitucion(admin, sustitucionPorAlumnoId);
  for (const entry of alumnos) {
    entry.via_sustitucion = badges.get(entry.alumno_id) || null;
  }
  return { alumnos, sinAlumnosAsignados: false };
}

// Marca cada sesión escrita vía sustitución con quién es el profesor
// sustituido — solo para la vista del admin (un profesor ya sabe si
// estaba cubriendo a alguien). No guarda ningún dato nuevo: se deriva de
// profesor_id (ya en la fila) + el estado de asignaciones/sustituciones
// en la fecha de la sesión (ver derivarSustitucionParaRegistro.js).
export async function enriquecerConAutoriaSustitucion(admin, { tenantId, alumnos, derivarFn }) {
  await Promise.all(
    alumnos.map(async (entry) => {
      if (!entry.sesion?.profesor_id) return;
      const info = await derivarFn(admin, {
        tenantId, profesorId: entry.sesion.profesor_id, alumnoId: entry.alumno_id, fecha: entry.sesion.fecha,
      });
      if (info) entry.sesion.en_sustitucion_de = info;
    })
  );
  return alumnos;
}

export default async function academiaSesionesRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/sesiones?fecha=YYYY-MM-DD — vista del diario para un día.
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = FechaQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "fecha (YYYY-MM-DD) requerida", requestId);
    const { fecha } = parsed.data;
    const diaSemana = diaSemanaFromFecha(fecha);

    const admin = createSupabaseAdmin();

    // Vista personal para el profesor (solo sus alumnos asignados, ver
    // academia_profesor_alumnos, migración 094); el admin sigue viendo
    // todo el tenant (ver fetchDiarioVisible).
    const { alumnos, sinAlumnosAsignados, error } = await fetchDiarioVisible(admin, {
      tenantId: auth.tenant.id,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      role: auth.membership.role,
      findProfesorIdFn: findProfesorId,
      fecha,
      diaSemana,
    });

    if (error) {
      req.log.error({ err: error, requestId }, "academia sesiones day-view fetch failed");
      return fail(reply, 500, "sesiones_fetch_failed", "Failed to fetch sesiones", requestId);
    }

    // Solo el admin necesita saber "quién cubría a quién" — un profesor ya
    // lo sabe (o es él mismo el que fichó la sesión).
    if (auth.membership.role === "admin") {
      await enriquecerConAutoriaSustitucion(admin, { tenantId: auth.tenant.id, alumnos, derivarFn: derivarSustitucionParaRegistro });
    }

    return ok(reply, { fecha, dia_semana: diaSemana, alumnos, sin_alumnos_asignados: Boolean(sinAlumnosAsignados) }, requestId);
  });

  // POST /api/v1/academia/sesiones — registra/actualiza la sesión de un alumno en una fecha.
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const parsed = SesionUpsertSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }
    const { alumno_id, fecha, tipo, asignatura, tema, asignaturas, comentario, comentario_privado, motivo_ausencia } = parsed.data;

    if (esClaseFuturaNoPermitida(tipo, fecha)) {
      return fail(reply, 422, "clase_futura_no_permitida", "Solo puedes registrar ausencias en fechas futuras.", requestId);
    }

    const admin = createSupabaseAdmin();

    const { data: alumno, error: alumnoErr } = await admin
      .from("academia_alumnos")
      .select("id")
      .eq("id", alumno_id)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();
    if (alumnoErr) return fail(reply, 500, "alumno_lookup_failed", "Failed to lookup alumno", requestId);
    if (!alumno) return fail(reply, 404, "alumno_not_found", "Alumno not found", requestId);

    const visible = await verificarAlumnoVisible(admin, {
      tenantId: auth.tenant.id, tenantSlug: auth.tenant.slug, userId: auth.user.id,
      role: auth.membership.role, findProfesorIdFn: findProfesorId, alumnoId: alumno_id,
    });
    if (!visible.ok) {
      if (visible.error) {
        req.log.error({ err: visible.error, requestId }, "academia sesiones: verificar alumno visible failed");
        return fail(reply, 500, "sesion_save_failed", "Failed to save sesion", requestId);
      }
      return fail(reply, 403, "alumno_no_visible", "No tienes acceso a este alumno.", requestId);
    }

    const profesorId = await findProfesorId(admin, auth.tenant.slug, auth.user.id);
    const asignaturasLimpias = normalizarAsignaturas(asignaturas, tipo);
    const primera = asignaturasLimpias[0] || null;

    const fields = {
      tenant_id: auth.tenant.id,
      alumno_id,
      fecha,
      profesor_id: profesorId,
      tipo,
      // asignatura/tema (texto) se mantienen por compatibilidad — siempre la
      // primera entrada de `asignaturas`, o el valor plano si el cliente no
      // envía el array.
      asignatura: tipo === "ausencia" ? null : (primera?.nombre || asignatura || null),
      tema: tipo === "ausencia" ? null : (primera?.tema || tema || null),
      asignaturas: asignaturasLimpias,
      comentario: comentario || null,
      comentario_privado: comentario_privado || null,
      motivo_ausencia: tipo === "ausencia" ? motivo_ausencia || null : null,
    };

    const { data: existing, error: findErr } = await admin
      .from("academia_sesiones")
      .select("id")
      .eq("tenant_id", auth.tenant.id)
      .eq("alumno_id", alumno_id)
      .eq("fecha", fecha)
      .maybeSingle();
    if (findErr) return fail(reply, 500, "sesion_lookup_failed", "Failed to lookup sesion", requestId);

    const query = existing
      ? admin.from("academia_sesiones").update(fields).eq("id", existing.id)
      : admin.from("academia_sesiones").insert(fields);

    const { data: saved, error: saveErr } = await query
      .select("id, alumno_id, fecha, tipo, asignatura, tema, asignaturas, comentario, comentario_privado, motivo_ausencia")
      .single();

    if (saveErr) {
      req.log.error({ err: saveErr, requestId }, "academia sesion save failed");
      return fail(reply, 500, "sesion_save_failed", "Failed to save sesion", requestId);
    }

    return ok(reply, { sesion: saved }, requestId);
  });
}
