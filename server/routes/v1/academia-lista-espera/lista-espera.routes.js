import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, created, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchListaEsperaDelTenant } from "../../../lib/academiaListaEspera/consultas.js";
import {
  crearEntradaListaEspera,
  actualizarEntradaListaEspera,
  eliminarEntradaListaEspera,
} from "../../../lib/academiaListaEspera/gestion.js";

// El email se valida como email solo si viene con algo escrito: la mayoría
// de los apuntes de la lista de espera se hacen por teléfono y no dejan
// correo, así que la cadena vacía tiene que seguir siendo válida (se
// guarda como null, ver gestion.js).
const EmailOpcional = z.union([z.literal(""), z.string().trim().email()]).optional();

const CrearEntradaSchema = z.object({
  nombre: z.string().trim().min(1),
  curso: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  email: EmailOpcional,
  notas: z.string().trim().optional(),
});

// PATCH parcial: lo que no viene, no se toca. `nombre`, si viene, no puede
// quedarse vacío — es lo que identifica la fila en la tabla.
const ActualizarEntradaSchema = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    curso: z.string().trim().optional(),
    telefono: z.string().trim().optional(),
    email: EmailOpcional,
    notas: z.string().trim().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, { message: "Nada que actualizar." });

const CODE_STATUS = {
  not_found: 404,
  sin_cambios: 400,
};

const CODE_MESSAGE = {
  not_found: "No se encontró esa entrada de la lista de espera.",
  sin_cambios: "No hay ningún cambio que guardar.",
};

// Exportados (no literales inline) para que un test fije esta decisión de
// seguridad sin depender de una sesión real — mismo criterio que
// ROLES_CREAR/ROLES_REVOCAR en sustituciones.routes.js. La política RLS de
// la tabla también permite a teacher (red de seguridad general del
// módulo academia), pero no hay ningún flujo de profesor que necesite
// esto todavía — no se expone en la API sin que exista ese caso de uso
// real (ver auditoría de la sesión anterior).
export const ROLES_LISTAR = ["admin"];
export const ROLES_CREAR = ["admin"];
export const ROLES_ACTUALIZAR = ["admin"];
export const ROLES_ELIMINAR = ["admin"];

// Registrado bajo prefix /api/v1/academia/lista-espera (ver server/app.js).
export default async function academiaListaEsperaRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ROLES_LISTAR });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { entradas, error } = await fetchListaEsperaDelTenant(admin, auth.tenant.id);
    if (error) {
      req.log.error({ err: error, requestId }, "academia lista espera listado failed");
      return fail(reply, 500, "lista_espera_fetch_failed", "No se pudo cargar la lista de espera.", requestId);
    }
    return ok(reply, { entradas }, requestId);
  });

  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ROLES_CREAR });
    if (!auth.ok) return;

    const parsed = CrearEntradaSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const resultado = await crearEntradaListaEspera(admin, { tenantId: auth.tenant.id, ...parsed.data });
    if (!resultado.ok) {
      req.log.error({ err: resultado, requestId }, "academia lista espera crear failed");
      return fail(reply, 500, resultado.code, "No se pudo añadir a la lista de espera.", requestId);
    }
    return created(reply, { entrada: resultado.entrada }, requestId);
  });

  app.patch("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ROLES_ACTUALIZAR });
    if (!auth.ok) return;

    const parsed = ActualizarEntradaSchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

    const admin = createSupabaseAdmin();
    const id = String(req.params?.id || "").trim();
    const resultado = await actualizarEntradaListaEspera(admin, { tenantId: auth.tenant.id, id, cambios: parsed.data });
    if (!resultado.ok) {
      const status = CODE_STATUS[resultado.code] || 500;
      if (status >= 500) req.log.error({ err: resultado, requestId }, "academia lista espera actualizar failed");
      return fail(reply, status, resultado.code, CODE_MESSAGE[resultado.code] || "No se pudo guardar el cambio.", requestId);
    }
    return ok(reply, { entrada: resultado.entrada }, requestId);
  });

  app.delete("/:id", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ROLES_ELIMINAR });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const id = String(req.params?.id || "").trim();
    const resultado = await eliminarEntradaListaEspera(admin, { tenantId: auth.tenant.id, id });
    if (!resultado.ok) {
      const status = CODE_STATUS[resultado.code] || 500;
      if (status >= 500) req.log.error({ err: resultado, requestId }, "academia lista espera eliminar failed");
      return fail(reply, status, resultado.code, CODE_MESSAGE[resultado.code] || "No se pudo eliminar de la lista de espera.", requestId);
    }
    return ok(reply, { eliminada: true }, requestId);
  });
}
