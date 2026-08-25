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
  insertarHorario,
  actualizarHorarioSiCambia,
  cerrarTarifaVigente,
  insertarTarifa,
  fetchAlumnoCompleto,
  mapAlumnoFamiliaPlana,
  enriquecerConTarifaYHorario,
} from "../../lib/academiaAlumnoHelpers.js";
import { provisionarAccesoAlumno } from "../../lib/academiaAlumnoAcceso.js";
import { fetchAccesoTutorActivo } from "../../lib/academiaConfig/accesoTutor.js";
import {
  ListQuerySchema,
  buildAlumnoCreateSchema,
  AlumnoUpdateSchema,
  HorarioUpdateSchema,
  ParamsSchema,
} from "../../lib/academiaAlumnoSchemas.js";

// academia_alumnos_list_activos siempre pagina con LIMIT/OFFSET — para el
// caso sin paginar (familiaCompleta.js) se le pide una "página" de este
// tamaño, más que suficiente para cualquier academia real, en vez de tener
// un segundo modo "sin límite" en la RPC.
const SIN_PAGINAR_PAGE_SIZE = 100000;

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

// `total` no es parte de la ficha del alumno (se calcula aparte, ver GET /)
// — se separa antes de aplanar la familia con el helper compartido.
function mapAlumnoActivoRpcRow({ total, ...resto }) {
  return mapAlumnoFamiliaPlana(resto);
}

// Compartido por ambas ramas de GET / (RPC de activos y query PostgREST de
// archivados/sin filtro) — todas sus dependencias llegan explícitas, no
// cierra sobre nada del handler. Añade tarifa_vigente (ya existía) y
// tiene_horario (nuevo) — el listado de Activos usa ambos para marcar
// alumnos con datos incompletos (ver alumnosListRow.js), sin bloquear nada.
async function enviarListaEnriquecida(reply, requestId, admin, tenantId, alumnos, { total, page, pageSize }) {
  const ids = alumnos.map((a) => a.id);
  let tarifas = [];
  let horarios = [];
  if (ids.length) {
    const [{ data: tarifasData, error: tarifaErr }, { data: horariosData, error: horarioErr }] = await Promise.all([
      admin
        .from("academia_tarifas")
        .select("alumno_id, precio_neto")
        .eq("tenant_id", tenantId)
        .in("alumno_id", ids)
        .is("fecha_fin", null),
      admin
        .from("academia_horario")
        .select("alumno_id")
        .eq("tenant_id", tenantId)
        .in("alumno_id", ids)
        .is("fecha_fin", null),
    ]);
    if (tarifaErr) return fail(reply, 500, "tarifas_fetch_failed", "Failed to fetch tarifas", requestId);
    if (horarioErr) return fail(reply, 500, "horario_fetch_failed", "Failed to fetch horario", requestId);
    tarifas = tarifasData;
    horarios = horariosData;
  }
  const items = enriquecerConTarifaYHorario(alumnos, tarifas, horarios);
  return ok(reply, { alumnos: items, total, page, pageSize }, requestId);
}

export default async function academiaAlumnosRoutes(app) {
  const guard = makeTenantMembershipGuard();

  // GET /api/v1/academia/alumnos?activo=
  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = ListQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    const { activo, q } = parsed.data;
    const paginar = parsed.data.page !== undefined;
    const page = parsed.data.page || 1;
    const pageSize = parsed.data.pageSize || 30;

    const admin = createSupabaseAdmin();

    // La RPC devuelve TODOS los alumnos con activo = true. Hasta la
    // migración 103 excluía a los que tenían cuenta de tutor creada y aún
    // no habían entrado al tutor, lo que vaciaba la pestaña Activos en un
    // centro que todavía no ha repartido el tutor a sus alumnos. Desde la
    // 103, acceso_activado viaja como dato en cada fila y no filtra nada.
    // Se usa tanto paginado (pestaña Activos) como sin paginar
    // (familiaCompleta.js, selector de hermanos: p_page_size grande para
    // traerlos todos de una vez, sin un segundo modo "sin límite" en la RPC).
    if (activo === "true") {
      const rpcPage = paginar ? page : 1;
      const rpcPageSize = paginar ? pageSize : SIN_PAGINAR_PAGE_SIZE;
      const { data: rows, error } = await admin.rpc("academia_alumnos_list_activos", {
        p_tenant_id: auth.tenant.id,
        p_q: q || null,
        p_page: rpcPage,
        p_page_size: rpcPageSize,
      });
      if (error) {
        req.log.error({ err: error, requestId }, "academia alumnos list activos (rpc) failed");
        return fail(reply, 500, "alumnos_fetch_failed", "Failed to fetch alumnos", requestId);
      }
      const alumnos = rows.map(mapAlumnoActivoRpcRow);
      return enviarListaEnriquecida(reply, requestId, admin, auth.tenant.id, alumnos, {
        total: paginar ? rows[0]?.total ?? 0 : alumnos.length,
        page,
        pageSize: paginar ? pageSize : alumnos.length,
      });
    }

    let query = admin
      .from("academia_alumnos")
      .select(
        "id, nombre, curso, nivel, activo, fecha_alta, fecha_baja, familia:academia_familias(id, nombre, email)",
        paginar ? { count: "exact" } : {}
      )
      .eq("tenant_id", auth.tenant.id)
      .order("nombre", { ascending: true });
    if (activo) query = query.eq("activo", activo === "true");
    if (q) query = query.ilike("nombre", `%${q}%`);
    if (paginar) {
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
    }

    const { data: alumnos, count, error } = await query;
    if (error) {
      req.log.error({ err: error, requestId }, "academia alumnos list failed");
      return fail(reply, 500, "alumnos_fetch_failed", "Failed to fetch alumnos", requestId);
    }

    return enviarListaEnriquecida(reply, requestId, admin, auth.tenant.id, alumnos || [], {
      total: paginar ? count ?? 0 : (alumnos || []).length,
      page,
      pageSize: paginar ? pageSize : (alumnos || []).length,
    });
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

    const admin = createSupabaseAdmin();

    // Si el centro no ha repartido el tutor (migración 105), el email del
    // alumno no se exige y no se le crea ninguna cuenta: no hay acceso que
    // darle todavía. El mismo valor decide las dos cosas, así que se lee una
    // vez aquí y se pasa explícito a las dos.
    const accesoTutorActivo = await fetchAccesoTutorActivo(admin, auth.tenant.id);

    const parsed = buildAlumnoCreateSchema({ exigeEmailAlumno: accesoTutorActivo }).safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    const {
      nombre, curso, fecha_alta, activo,
      email, telefono, direccion, ciudad, codigo_postal,
      familia_id, familia_nueva, familia_actualizada, horario, tarifa,
    } = parsed.data;

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

    // Acceso al tutor — no bloquea la creación del alumno si falla; la ficha
    // ya existe y es lo prioritario, se loguea aparte para no perderlo.
    let accesoWarning = null;
    const acceso = accesoTutorActivo
      ? await provisionarAccesoAlumno(admin, {
          tenantId: auth.tenant.id, tenantName: auth.tenant.name, email, nombre, logger: req.log,
        })
      // Tutor apagado: ni cuenta en auth.users, ni membresía, ni el correo
      // "Tu acceso a TutorDigital". Un centro que da de alta a sus 40
      // alumnos en septiembre no debe mandarles una invitación a algo que
      // no repartirá hasta enero.
      : { ok: true, provisioned: false };
    if (!acceso.ok) {
      req.log.error({ err: acceso.error, requestId }, "academia alumno: provisionar acceso failed");
      accesoWarning = "El alumno se creó, pero no se pudo dar de alta su acceso al tutor.";
    } else if (acceso.provisioned) {
      const { error: linkErr } = await admin
        .from("academia_alumnos")
        .update({ student_id: acceso.studentId })
        .eq("id", alumno.id)
        .eq("tenant_id", auth.tenant.id);
      if (linkErr) {
        req.log.error({ err: linkErr, requestId }, "academia alumno: student_id link failed");
        accesoWarning = "El alumno se creó, pero no se pudo enlazar su ficha con la cuenta de acceso.";
      }
    }

    const { data: completo, error: fetchErr } = await fetchAlumnoCompleto(admin, auth.tenant.id, alumno.id);
    if (fetchErr) return fail(reply, 500, "alumno_fetch_failed", "Failed to fetch created alumno", requestId);
    return created(reply, { alumno: completo, acceso_warning: accesoWarning }, requestId);
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

    const { error: actualizarErr } = await actualizarHorarioSiCambia(admin, auth.tenant.id, alumnoId, parsed.data.horario, hoy);
    if (actualizarErr) return fail(reply, 500, "horario_update_failed", "Failed to update horario", requestId);

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
}
