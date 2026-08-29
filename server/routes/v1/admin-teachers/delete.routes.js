import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { motivosQueImpidenEliminar, eliminarProfesor } from "../../../lib/adminTeachers/eliminarProfesor.js";

const ParamsSchema = z.object({ profileId: z.string().uuid() });

// DELETE /admin/teachers/:profileId — quita a un profesor de la plantilla.
//
// Es la salida para el ERROR (ficha creada por equivocación o duplicada),
// no para la baja de alguien que se va: para eso está `is_active` (PATCH),
// que conserva diario, horario y fichajes. Aquí, si hay cualquier rastro,
// se responde 409 diciendo QUÉ lo impide y se propone dar de baja.
export default async function adminTeachersDeleteRoutes(app) {
  const tenantMembershipGuard = makeTenantMembershipGuard();

  app.delete(
    "/admin/teachers/:profileId",
    { preHandler: tenantMembershipGuard.preHandler },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsed = ParamsSchema.safeParse(req.params || {});
      if (!parsed.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

      const admin = createSupabaseAdmin();

      const { data: profile, error: lookupErr } = await admin
        .from("teacher_profiles")
        .select("id, email, user_id, display_name")
        .eq("id", parsed.data.profileId)
        .eq("tenant_slug", tenantSlug)
        .maybeSingle();
      if (lookupErr) return fail(reply, 500, "profile_lookup_failed", "Failed to fetch profile", requestId);
      if (!profile) return fail(reply, 404, "profile_not_found", "Perfil de docente no encontrado", requestId);

      // La ficha de profesor de la propia cuenta que está pidiendo el
      // borrado no se toca desde aquí: la crea y la gobierna el interruptor
      // "El administrador da clase" (migración 108), y borrarla por detrás
      // dejaría ese ajuste diciendo una cosa y la realidad otra.
      if (profile.user_id && profile.user_id === auth.user.id) {
        return fail(reply, 409, "propia_ficha_profesor",
          "Es tu propia ficha de profesor. Se gestiona desde Ajustes › El administrador da clase.", requestId);
      }

      const { motivos, error: motivosErr } = await motivosQueImpidenEliminar(admin, {
        profile, tenantId: auth.tenant.id,
      });
      if (motivosErr) {
        req.log.error({ err: motivosErr, requestId }, "admin teachers delete checks failed");
        return fail(reply, 500, "delete_checks_failed", "No se pudo comprobar el histórico del profesor", requestId);
      }
      if (motivos.length) {
        return fail(reply, 409, "profesor_con_historico",
          `No se puede eliminar: ${motivos.join(", ")}. Dale de baja en su lugar — así deja de aparecer pero se conserva su histórico.`,
          requestId, { motivos });
      }

      const { error } = await eliminarProfesor(admin, { profile, tenantId: auth.tenant.id });
      if (error) {
        req.log.error({ err: error, requestId }, "admin teachers delete failed");
        return fail(reply, 500, "profesor_delete_failed", "No se pudo eliminar el profesor", requestId);
      }

      return ok(reply, { deleted: true }, requestId);
    }
  );
}
