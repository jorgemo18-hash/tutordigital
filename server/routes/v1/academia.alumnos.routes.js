import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import {
  nivelDeCurso,
  resolverFamiliaId,
  actualizarFamilia,
  cerrarHorarioVigente,
  insertarHorario,
  cerrarTarifaVigente,
  insertarTarifa,
  fetchAlumnoCompleto,
} from "../../lib/academiaAlumnoHelpers.js";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^\d{2}:\d{2}(:\d{2})?$/;

const FamiliaNuevaSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.string().trim().email().optional().nullable(),
  telefono: z.string().trim().optional().nullable(),
  dni: z.string().trim().optional().nullable(),
  direccion: z.string().trim().optional().nullable(),
  ciudad: z.string().trim().optional().nullable(),
  codigo_postal: z.string().trim().optional().nullable(),
  metodo_pago: z.enum(["bizum", "domiciliado", "transferencia", "efectivo"]).optional().nullable(),
  codigo_sepa: z.string().trim().optional().nullable(),
  notas: z.string().trim().optional().nullable(),
});

const HorarioEntrySchema = z.object({
  dia_semana: z.number().int().min(1).max(6),
  hora_inicio: z.string().regex(HORA_RE),
  hora_fin: z.string().regex(HORA_RE),
});

const TarifaSchema = z.object({
  precio_bruto: z.number().min(0),
  descuento_pct: z.number().min(0).max(100).optional().default(0),
});

const ListQuerySchema = z.object({
  activo: z.enum(["true", "false"]).optional(),
  sin_familia: z.enum(["true", "false"]).optional(),
});

// "" en vez de null/ausente rompía z.string().email() con un 400 confuso
// (mismo problema ya visto en academia.familias.routes.js) — el frontend
// ya manda null para el campo vacío, esto es solo defensa en profundidad.
const vacioAUndefined = (v) => (v === "" ? undefined : v);

const ContactoAlumnoSchema = {
  email: z.preprocess(vacioAUndefined, z.string().trim().email().optional().nullable()),
  telefono: z.string().trim().optional().nullable(),
  direccion: z.string().trim().optional().nullable(),
  ciudad: z.string().trim().optional().nullable(),
  codigo_postal: z.string().trim().optional().nullable(),
};

const AlumnoCreateSchema = z.object({
  nombre: z.string().trim().min(1),
  curso: z.string().trim().min(1),
  fecha_alta: z.string().regex(FECHA_RE),
  // false para los borradores creados desde una ficha de inscripción
  // escaneada (OCR) — el admin los revisa y activa desde la pestaña
  // "Pendientes" antes de que el alumno aparezca como activo.
  activo: z.boolean().optional().default(true),
  ...ContactoAlumnoSchema,
  familia_id: z.string().uuid().optional().nullable(),
  familia_nueva: FamiliaNuevaSchema.optional().nullable(),
  // Edita en el sitio una familia existente elegida en el selector, antes
  // de vincularla al alumno nuevo (mismo botón "Editar" que en PUT /:id).
  familia_actualizada: FamiliaNuevaSchema.optional().nullable(),
  horario: z.array(HorarioEntrySchema).optional().default([]),
  tarifa: TarifaSchema.optional().nullable(),
});

const AlumnoUpdateSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  curso: z.string().trim().min(1).optional(),
  fecha_alta: z.string().regex(FECHA_RE).optional(),
  ...ContactoAlumnoSchema,
  familia_id: z.string().uuid().nullable().optional(),
  familia_nueva: FamiliaNuevaSchema.optional().nullable(),
  // Edita en el sitio la familia YA vinculada al alumno (botón "Editar" del
  // drawer sobre una familia existente) — distinto de familia_nueva, que
  // siempre crea una fila nueva.
  familia_actualizada: FamiliaNuevaSchema.optional().nullable(),
  tarifa: TarifaSchema.optional().nullable(),
});

const HorarioUpdateSchema = z.object({ horario: z.array(HorarioEntrySchema) });
const ParamsSchema = z.object({ id: z.string().uuid() });

async function assertAlumnoEnTenant(admin, alumnoId, tenantId) {
  const { data, error } = await admin
    .from("academia_alumnos")
    .select("id, fecha_alta, familia_id")
    .eq("id", alumnoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, code: "alumno_lookup_failed" };
  if (!data) return { ok: false, status: 404, code: "alumno_not_found" };
  return { ok: true, alumno: data };
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function academiaAlumnosRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/alumnos?activo=&sin_familia=
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = ListQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    const { activo, sin_familia } = parsed.data;

    const admin = createSupabaseAdmin();
    let query = admin
      .from("academia_alumnos")
      .select("id, nombre, curso, nivel, activo, fecha_alta, fecha_baja, familia:academia_familias(id, nombre, email)")
      .eq("tenant_id", auth.tenant.id)
      .order("nombre", { ascending: true });
    if (activo) query = query.eq("activo", activo === "true");
    if (sin_familia === "true") query = query.is("familia_id", null);

    const { data: alumnos, error } = await query;
    if (error) {
      req.log.error({ err: error, requestId }, "academia alumnos list failed");
      return fail(reply, 500, "alumnos_fetch_failed", "Failed to fetch alumnos", requestId);
    }

    const ids = (alumnos || []).map((a) => a.id);
    let tarifaPorAlumno = {};
    if (ids.length) {
      const { data: tarifas, error: tarifaErr } = await admin
        .from("academia_tarifas")
        .select("alumno_id, precio_neto")
        .eq("tenant_id", auth.tenant.id)
        .in("alumno_id", ids)
        .is("fecha_fin", null);
      if (tarifaErr) return fail(reply, 500, "tarifas_fetch_failed", "Failed to fetch tarifas", requestId);
      tarifaPorAlumno = Object.fromEntries((tarifas || []).map((t) => [t.alumno_id, { precio_neto: t.precio_neto }]));
    }

    const items = (alumnos || []).map((a) => ({ ...a, tarifa_vigente: tarifaPorAlumno[a.id] || null }));
    return ok(reply, { alumnos: items }, requestId);
  });

  // GET /api/v1/academia/alumnos/:id
  app.get("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const { data, error } = await fetchAlumnoCompleto(admin, auth.tenant.id, parsedParams.data.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia alumno fetch failed");
      return fail(reply, 500, "alumno_fetch_failed", "Failed to fetch alumno", requestId);
    }
    if (!data) return fail(reply, 404, "alumno_not_found", "Alumno not found", requestId);
    return ok(reply, { alumno: data }, requestId);
  });

  // POST /api/v1/academia/alumnos
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = AlumnoCreateSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    const {
      nombre, curso, fecha_alta, activo,
      email, telefono, direccion, ciudad, codigo_postal,
      familia_id, familia_nueva, familia_actualizada, horario, tarifa,
    } = parsed.data;

    const admin = createSupabaseAdmin();

    if (familia_actualizada && familia_id) {
      const { error: famUpdateErr } = await actualizarFamilia(admin, auth.tenant.id, familia_id, familia_actualizada);
      if (famUpdateErr) {
        req.log.error({ err: famUpdateErr, requestId }, "academia familia update failed");
        return fail(reply, 500, "familia_update_failed", "Failed to update familia", requestId);
      }
    }

    const familiaRes = await resolverFamiliaId(admin, auth.tenant.id, { familiaId: familia_id, familiaNueva: familia_nueva });
    if (!familiaRes.ok) {
      if (familiaRes.notFound) return fail(reply, 404, "familia_not_found", "Familia not found", requestId);
      req.log.error({ err: familiaRes.error, requestId }, "academia familia resolve failed");
      return fail(reply, 500, "familia_resolve_failed", "Failed to resolve familia", requestId);
    }

    const { data: alumno, error: alumnoErr } = await admin
      .from("academia_alumnos")
      .insert({
        tenant_id: auth.tenant.id,
        familia_id: familiaRes.familiaId,
        nombre,
        curso,
        nivel: nivelDeCurso(curso),
        fecha_alta,
        activo,
        email,
        telefono,
        direccion,
        ciudad,
        codigo_postal,
      })
      .select("id")
      .single();
    if (alumnoErr) {
      req.log.error({ err: alumnoErr, requestId }, "academia alumno create failed");
      return fail(reply, 500, "alumno_create_failed", "Failed to create alumno", requestId);
    }

    const { error: horarioErr } = await insertarHorario(admin, auth.tenant.id, alumno.id, horario, fecha_alta);
    if (horarioErr) return fail(reply, 500, "horario_create_failed", "Failed to create horario", requestId);

    if (tarifa) {
      const { error: tarifaErr } = await insertarTarifa(admin, auth.tenant.id, alumno.id, tarifa, fecha_alta);
      if (tarifaErr) return fail(reply, 500, "tarifa_create_failed", "Failed to create tarifa", requestId);
    }

    const { data: completo, error: fetchErr } = await fetchAlumnoCompleto(admin, auth.tenant.id, alumno.id);
    if (fetchErr) return fail(reply, 500, "alumno_fetch_failed", "Failed to fetch created alumno", requestId);
    return created(reply, { alumno: completo }, requestId);
  });

  // PUT /api/v1/academia/alumnos/:id
  app.put("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);
    const parsed = AlumnoUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const alumnoCheck = await assertAlumnoEnTenant(admin, parsedParams.data.id, auth.tenant.id);
    if (!alumnoCheck.ok) return fail(reply, alumnoCheck.status, alumnoCheck.code, "Alumno not found", requestId);
    const alumnoId = parsedParams.data.id;

    const {
      nombre, curso, fecha_alta,
      email, telefono, direccion, ciudad, codigo_postal,
      familia_id, familia_nueva, familia_actualizada, tarifa,
    } = parsed.data;
    const fields = {};
    if (nombre !== undefined) fields.nombre = nombre;
    if (curso !== undefined) { fields.curso = curso; fields.nivel = nivelDeCurso(curso); }
    if (fecha_alta !== undefined) fields.fecha_alta = fecha_alta;
    if (email !== undefined) fields.email = email;
    if (telefono !== undefined) fields.telefono = telefono;
    if (direccion !== undefined) fields.direccion = direccion;
    if (ciudad !== undefined) fields.ciudad = ciudad;
    if (codigo_postal !== undefined) fields.codigo_postal = codigo_postal;

    // Usa el familia_id del body (la familia seleccionada ahora en el
    // drawer), no la que el alumno tenía guardada — así "cambiar de familia
    // existente Y editarla" actualiza la recién elegida, no la anterior.
    if (familia_actualizada && familia_id) {
      const { error: famUpdateErr } = await actualizarFamilia(admin, auth.tenant.id, familia_id, familia_actualizada);
      if (famUpdateErr) {
        req.log.error({ err: famUpdateErr, requestId }, "academia familia update failed");
        return fail(reply, 500, "familia_update_failed", "Failed to update familia", requestId);
      }
      fields.familia_id = familia_id;
    } else if (familia_nueva || familia_id !== undefined) {
      const familiaRes = await resolverFamiliaId(admin, auth.tenant.id, { familiaId: familia_id, familiaNueva: familia_nueva });
      if (!familiaRes.ok) {
        if (familiaRes.notFound) return fail(reply, 404, "familia_not_found", "Familia not found", requestId);
        req.log.error({ err: familiaRes.error, requestId }, "academia familia resolve failed");
        return fail(reply, 500, "familia_resolve_failed", "Failed to resolve familia", requestId);
      }
      fields.familia_id = familiaRes.familiaId;
    }

    if (Object.keys(fields).length) {
      const { error: updateErr } = await admin
        .from("academia_alumnos")
        .update(fields)
        .eq("id", alumnoId)
        .eq("tenant_id", auth.tenant.id);
      if (updateErr) {
        req.log.error({ err: updateErr, requestId }, "academia alumno update failed");
        return fail(reply, 500, "alumno_update_failed", "Failed to update alumno", requestId);
      }
    }

    if (tarifa) {
      const hoy = hoyISO();
      const { error: cerrarErr } = await cerrarTarifaVigente(admin, auth.tenant.id, alumnoId, hoy);
      if (cerrarErr) return fail(reply, 500, "tarifa_close_failed", "Failed to close tarifa", requestId);
      const { error: tarifaErr } = await insertarTarifa(admin, auth.tenant.id, alumnoId, tarifa, hoy);
      if (tarifaErr) return fail(reply, 500, "tarifa_create_failed", "Failed to create tarifa", requestId);
    }

    const { data: completo, error: fetchErr } = await fetchAlumnoCompleto(admin, auth.tenant.id, alumnoId);
    if (fetchErr) return fail(reply, 500, "alumno_fetch_failed", "Failed to fetch updated alumno", requestId);
    return ok(reply, { alumno: completo }, requestId);
  });

  // PUT /api/v1/academia/alumnos/:id/horario
  app.put("/:id/horario", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);
    const parsed = HorarioUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const alumnoCheck = await assertAlumnoEnTenant(admin, parsedParams.data.id, auth.tenant.id);
    if (!alumnoCheck.ok) return fail(reply, alumnoCheck.status, alumnoCheck.code, "Alumno not found", requestId);
    const alumnoId = parsedParams.data.id;
    const hoy = hoyISO();

    const { error: cerrarErr } = await cerrarHorarioVigente(admin, auth.tenant.id, alumnoId, hoy);
    if (cerrarErr) return fail(reply, 500, "horario_close_failed", "Failed to close horario", requestId);

    const { error: insertErr } = await insertarHorario(admin, auth.tenant.id, alumnoId, parsed.data.horario, hoy);
    if (insertErr) return fail(reply, 500, "horario_create_failed", "Failed to create horario", requestId);

    const { data: horario, error: fetchErr } = await admin
      .from("academia_horario")
      .select("id, dia_semana, hora_inicio, hora_fin")
      .eq("tenant_id", auth.tenant.id)
      .eq("alumno_id", alumnoId)
      .is("fecha_fin", null)
      .order("dia_semana", { ascending: true })
      .order("hora_inicio", { ascending: true });
    if (fetchErr) return fail(reply, 500, "horario_fetch_failed", "Failed to fetch horario", requestId);
    return ok(reply, { horario: horario || [] }, requestId);
  });

  // DELETE /api/v1/academia/alumnos/:id/archivar
  app.delete("/:id/archivar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsedParams = ParamsSchema.safeParse(req.params || {});
    if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

    const admin = createSupabaseAdmin();
    const alumnoCheck = await assertAlumnoEnTenant(admin, parsedParams.data.id, auth.tenant.id);
    if (!alumnoCheck.ok) return fail(reply, alumnoCheck.status, alumnoCheck.code, "Alumno not found", requestId);

    const { error } = await admin
      .from("academia_alumnos")
      .update({ activo: false, fecha_baja: hoyISO() })
      .eq("id", parsedParams.data.id)
      .eq("tenant_id", auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia alumno archive failed");
      return fail(reply, 500, "alumno_archive_failed", "Failed to archive alumno", requestId);
    }
    return ok(reply, { archived: true, id: parsedParams.data.id }, requestId);
  });
}
