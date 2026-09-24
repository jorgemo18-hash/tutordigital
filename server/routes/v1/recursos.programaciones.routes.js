import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { materiaPorSlug } from "../../lib/curriculo/curriculoAragon.js";
import {
  DatosSchema, CabeceraSchema, MAX_BYTES,
  misProgramaciones, creaProgramacion, leeProgramacion, guardaProgramacion, borraProgramacion,
} from "../../lib/programaciones/programaciones.js";

// RECURSOS → PROGRAMACIÓN (migración 130): las programaciones didácticas
// del profesor.
//   GET    /                las mías
//   POST   /                nueva { materia_slug, curso, titulo, datos? }
//   GET    /:id             una, entera
//   PUT    /:id             guardar { titulo?, datos }
//   DELETE /:id             borrarla
export const ROLES = ["teacher", "admin"];

const Id = z.string().uuid();
const Nueva = CabeceraSchema.extend({ datos: DatosSchema.optional() });
const Guardar = z.object({ titulo: z.string().max(200).optional(), datos: DatosSchema });

export function crearRutasDeProgramaciones({ adminFn = createSupabaseAdmin } = {}) {
  return async function recursosProgramacionesRoutes(app) {
    const guard = makeTenantMembershipGuard();

    async function autoriza(req, reply) {
      const requestId = req.requestId || makeRequestId();
      const auth = await requireRole(req, reply, requestId, { tenantSlug: getTenantSlug(req), roles: ROLES });
      return { requestId, auth };
    }
    const grande = (x) => Buffer.byteLength(JSON.stringify(x || {})) > MAX_BYTES;
    const quien = (auth) => ({ admin: adminFn(), tenantId: auth.tenant.id, userId: auth.user.id });

    app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
      const { requestId, auth } = await autoriza(req, reply);
      if (!auth.ok) return;
      try {
        return ok(reply, { programaciones: await misProgramaciones(quien(auth)) }, requestId);
      } catch (err) {
        req.log.error({ err, requestId }, "programaciones: no se pudieron listar");
        return fail(reply, 500, "programaciones_no_listadas", "No se pudieron cargar las programaciones", requestId);
      }
    });

    app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
      const { requestId, auth } = await autoriza(req, reply);
      if (!auth.ok) return;
      const p = Nueva.safeParse(req.body || {});
      if (!p.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: p.error.issues });
      if (!materiaPorSlug(p.data.materia_slug)) return fail(reply, 400, "materia_desconocida", "Esa materia no está en el currículo", requestId);
      if (grande(p.data.datos)) return fail(reply, 413, "demasiado_grande", "La programación es demasiado grande", requestId);
      const { datos = {}, ...cabecera } = p.data;
      try {
        return ok(reply, await creaProgramacion({ ...quien(auth), cabecera, datos }), requestId);
      } catch (err) {
        req.log.error({ err, requestId }, "programaciones: no se pudo crear");
        return fail(reply, 500, "programacion_no_creada", "No se pudo crear la programación", requestId);
      }
    });

    app.get("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
      const { requestId, auth } = await autoriza(req, reply);
      if (!auth.ok) return;
      const id = Id.safeParse(req.params?.id);
      if (!id.success) return fail(reply, 400, "invalid_id", "Invalid id", requestId);
      try {
        const prog = await leeProgramacion({ ...quien(auth), id: id.data });
        if (!prog) return fail(reply, 404, "programacion_no_encontrada", "Esa programación no existe", requestId);
        return ok(reply, prog, requestId);
      } catch (err) {
        req.log.error({ err, requestId }, "programaciones: no se pudo leer");
        return fail(reply, 500, "programacion_no_leida", "No se pudo abrir la programación", requestId);
      }
    });

    app.put("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
      const { requestId, auth } = await autoriza(req, reply);
      if (!auth.ok) return;
      const id = Id.safeParse(req.params?.id);
      const p = Guardar.safeParse(req.body || {});
      if (!id.success || !p.success) {
        return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: p.error?.issues });
      }
      if (grande(p.data.datos)) return fail(reply, 413, "demasiado_grande", "La programación es demasiado grande", requestId);
      try {
        const prog = await guardaProgramacion({ ...quien(auth), id: id.data, titulo: p.data.titulo, datos: p.data.datos });
        if (!prog) return fail(reply, 404, "programacion_no_encontrada", "Esa programación no existe", requestId);
        return ok(reply, prog, requestId);
      } catch (err) {
        req.log.error({ err, requestId }, "programaciones: no se pudo guardar");
        return fail(reply, 500, "programacion_no_guardada", "No se pudo guardar la programación", requestId);
      }
    });

    app.delete("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
      const { requestId, auth } = await autoriza(req, reply);
      if (!auth.ok) return;
      const id = Id.safeParse(req.params?.id);
      if (!id.success) return fail(reply, 400, "invalid_id", "Invalid id", requestId);
      try {
        const borrada = await borraProgramacion({ ...quien(auth), id: id.data });
        if (!borrada) return fail(reply, 404, "programacion_no_encontrada", "Esa programación no existe", requestId);
        return ok(reply, { borrada: true }, requestId);
      } catch (err) {
        req.log.error({ err, requestId }, "programaciones: no se pudo borrar");
        return fail(reply, 500, "programacion_no_borrada", "No se pudo borrar la programación", requestId);
      }
    });
  };
}

export default crearRutasDeProgramaciones();
