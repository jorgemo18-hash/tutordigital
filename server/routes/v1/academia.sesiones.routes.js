import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const FechaQuerySchema = z.object({ fecha: z.string().regex(FECHA_RE) });

const SesionUpsertSchema = z.object({
  alumno_id: z.string().uuid(),
  fecha: z.string().regex(FECHA_RE),
  tipo: z.enum(["clase", "ausencia"]),
  asignatura: z.string().trim().max(120).optional().nullable(),
  tema: z.string().trim().max(500).optional().nullable(),
  comentario: z.string().trim().max(2000).optional().nullable(),
  comentario_privado: z.string().trim().max(2000).optional().nullable(),
  motivo_ausencia: z.string().trim().max(500).optional().nullable(),
});

// dia_semana en academia_horario usa 1=lunes…5=viernes, igual que Date#getDay()
// para Mon–Fri (0=domingo, 6=sábado quedan fuera del check constraint).
export function diaSemanaFromFecha(fechaISO) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
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

async function findProfesorId(admin, tenantId, userId) {
  const { data } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id || null;
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

    const horarioQuery = admin
      .from("academia_horario")
      .select(
        "hora_inicio, hora_fin, fecha_inicio, fecha_fin, " +
          "alumno:academia_alumnos(id, nombre, curso, nivel, activo)"
      )
      .eq("tenant_id", auth.tenant.id)
      .eq("dia_semana", diaSemana)
      .lte("fecha_inicio", fecha)
      .or(`fecha_fin.is.null,fecha_fin.gte.${fecha}`);

    const sesionesQuery = admin
      .from("academia_sesiones")
      .select(
        "id, alumno_id, fecha, hora, tipo, asignatura, tema, comentario, comentario_privado, motivo_ausencia, " +
          "alumno:academia_alumnos(id, nombre, curso, nivel)"
      )
      .eq("tenant_id", auth.tenant.id)
      .eq("fecha", fecha);

    const [horarioRes, sesionesRes] = await Promise.all([horarioQuery, sesionesQuery]);
    if (horarioRes.error || sesionesRes.error) {
      req.log.error(
        { err: horarioRes.error || sesionesRes.error, requestId },
        "academia sesiones day-view fetch failed"
      );
      return fail(reply, 500, "sesiones_fetch_failed", "Failed to fetch sesiones", requestId);
    }

    const alumnos = mergeHorarioYSesiones(horarioRes.data, sesionesRes.data);
    return ok(reply, { fecha, dia_semana: diaSemana, alumnos }, requestId);
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
    const { alumno_id, fecha, tipo, asignatura, tema, comentario, comentario_privado, motivo_ausencia } = parsed.data;

    const admin = createSupabaseAdmin();

    const { data: alumno, error: alumnoErr } = await admin
      .from("academia_alumnos")
      .select("id")
      .eq("id", alumno_id)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();
    if (alumnoErr) return fail(reply, 500, "alumno_lookup_failed", "Failed to lookup alumno", requestId);
    if (!alumno) return fail(reply, 404, "alumno_not_found", "Alumno not found", requestId);

    const profesorId = await findProfesorId(admin, auth.tenant.id, auth.user.id);

    const fields = {
      tenant_id: auth.tenant.id,
      alumno_id,
      fecha,
      profesor_id: profesorId,
      tipo,
      asignatura: asignatura || null,
      tema: tema || null,
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
      .select("id, alumno_id, fecha, tipo, asignatura, tema, comentario, comentario_privado, motivo_ausencia")
      .single();

    if (saveErr) {
      req.log.error({ err: saveErr, requestId }, "academia sesion save failed");
      return fail(reply, 500, "sesion_save_failed", "Failed to save sesion", requestId);
    }

    return ok(reply, { sesion: saved }, requestId);
  });
}
