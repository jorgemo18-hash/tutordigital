import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { ok, fail } from "../../../lib/http.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { syncTeacherSubjects, syncTeacherGroups } from "../../../lib/teacherUtils.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { ensureGroupsBelongToTenant } from "../../../lib/adminTeacherQueries.js";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const PatchTeacherSchema = z.object({
  display_name:    z.string().min(1).max(120).optional(),
  email:           z.string().email().optional(),
  is_active:       z.boolean().optional(),
  // telefono/direccion/nif_dni/fecha_alta: solo los usa el drawer de
  // profesor del panel admin-academia (ver migraciones 094/095) —
  // instituto nunca los envía, el update queda igual de condicional que
  // el resto de campos.
  telefono:        z.string().trim().max(30).optional().nullable(),
  direccion:       z.string().trim().max(200).optional().nullable(),
  nif_dni:         z.string().trim().max(20).optional().nullable(),
  fecha_alta:      z.string().regex(FECHA_RE).optional().nullable(),
  assignments:     z.array(z.object({
    subject:   z.string().min(1).max(80),
    group_ids: z.array(z.string().uuid()),
  })).optional(),
  // group_ids: all groups the teacher belongs to, regardless of subject selection.
  // Sent separately so groups without subjects are not silently dropped.
  group_ids:       z.array(z.string().uuid()).optional(),
  tutor_group_ids: z.array(z.string().uuid()).optional(),
});

// PATCH /admin/teachers/:profileId — extraído de admin.teachers.routes.js.
// Edita nombre, email, is_active, contacto (telefono/direccion) y
// asignaciones de un docente con perfil. assignments/group_ids son solo
// de instituto (academia nunca los envía, no tiene grupos/asignaturas —
// el bloque de sync simplemente no se ejecuta).
export default async function adminTeachersPatchRoutes(app) {
  const tenantMembershipGuard = makeTenantMembershipGuard();

  app.patch(
    "/admin/teachers/:profileId",
    { preHandler: tenantMembershipGuard.preHandler },
    async (req, reply) => {
      const requestId  = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const profileId = String(req.params?.profileId || "").trim();
      if (!profileId) return fail(reply, 400, "missing_profile_id", "profileId requerido", requestId);

      const parsed = PatchTeacherSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
      }

      const rl = await rateLimit(req, { limit: 40, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();

      // Verificar que el perfil pertenece al tenant
      const { data: profile } = await admin
        .from("teacher_profiles")
        .select("id, email, user_id, is_active")
        .eq("id", profileId)
        .eq("tenant_slug", tenantSlug)
        .maybeSingle();

      if (!profile) return fail(reply, 404, "profile_not_found", "Perfil de docente no encontrado", requestId);

      const {
        display_name, email, is_active, telefono, direccion, nif_dni, fecha_alta,
        assignments, group_ids, tutor_group_ids,
      } = parsed.data;

      // Actualizar campos del perfil
      const profileUpdates = {};
      if (display_name !== undefined) profileUpdates.display_name = display_name;
      if (is_active    !== undefined) profileUpdates.is_active    = is_active;
      if (email        !== undefined) profileUpdates.email        = email.toLowerCase().trim();
      if (telefono     !== undefined) profileUpdates.telefono     = telefono || null;
      if (direccion    !== undefined) profileUpdates.direccion    = direccion || null;
      if (nif_dni      !== undefined) profileUpdates.nif_dni      = nif_dni || null;
      if (fecha_alta   !== undefined) profileUpdates.fecha_alta   = fecha_alta || null;

      if (Object.keys(profileUpdates).length) {
        const { error: updateErr } = await admin
          .from("teacher_profiles")
          .update(profileUpdates)
          .eq("id", profileId)
          .eq("tenant_slug", tenantSlug);
        if (updateErr) return fail(reply, 500, "update_failed", "No se pudo actualizar el perfil", requestId);
      }

      // Si el email cambió y el docente tiene usuario en Supabase Auth, actualizarlo
      const newEmail = email?.toLowerCase().trim();
      if (newEmail && newEmail !== profile.email.toLowerCase().trim() && profile.user_id) {
        try {
          await admin.auth.admin.updateUserById(profile.user_id, { email: newEmail });
        } catch (authErr) {
          req.log.warn({ authErr, profileId }, "supabase_auth_email_update_failed");
        }
      }

      // Sincronizar grupos/asignaturas cuando alguno de los dos campos está presente.
      // group_ids contiene TODOS los grupos del docente (incluso los que no tienen asignaturas),
      // evitando que syncTeacherGroups los elimine silenciosamente.
      if (assignments !== undefined || group_ids !== undefined) {
        const allGroupIds = group_ids !== undefined
          ? [...new Set(group_ids.filter(Boolean))]
          : [...new Set((assignments || []).flatMap(a => a.group_ids).filter(Boolean))];

        if (allGroupIds.length) {
          const groupsCheck = await ensureGroupsBelongToTenant(admin, auth.tenant.id, allGroupIds);
          if (!groupsCheck.ok) {
            return fail(reply, 400, groupsCheck.reason, "Grupos inválidos para este centro", requestId);
          }
        }
        const allSubjects = (assignments || []).map(a => a.subject).filter(Boolean);
        await syncTeacherSubjects(admin, profileId, tenantSlug, allSubjects);
        await syncTeacherGroups(admin, profileId, allGroupIds, null, {
          assignments:    assignments || [],
          tenantSlug,
          tutorGroupIds:  tutor_group_ids,
        });
      }

      return ok(reply, { id: profileId, updated: true }, requestId);
    }
  );
}
