import { randomBytes } from "crypto";
import { ok, fail } from "../../lib/http.js";
import { sendAdminInviteEmail } from "../../lib/email.js";
import { requireSuperAdmin } from "../../lib/superadminGuard.js";
import { CATEGORIAS_GASTO_PREDEFINIDAS } from "../../lib/academiaFinanzas/gastoCategoriasPredefinidas.js";
import { z } from "zod";

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(12)).map(b => chars[b % chars.length]).join("");
}

// regimen_fiscal y sector son mutuamente exclusivos según el tipo de
// centro (ver assets/superadmin/views/nuevoCentroForm.js), pero el backend
// no lo fuerza — ambos quedan en null en BD si no se envían, sea cual sea
// el tipo.
const CreateTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug solo puede contener letras minúsculas, números y guiones"),
  type: z.enum(["academia", "standalone", "integrado"]).optional(),
  regimen_fiscal: z.enum(["autonomo", "sociedad"]).optional(),
  sector: z.enum(["publico", "privado", "concertado"]).optional(),
  admin: z.object({
    first_name: z.string().min(1).max(100),
    last_name:  z.string().min(1).max(100),
    email:      z.string().email("Email de administrador inválido"),
    phone:      z.string().max(30).optional(),
  }).optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────
// Alta de centro: crea el tenant y, si se proporcionan datos de admin,
// también su usuario, perfil, membership e invitación por email. Aislado
// en su propio archivo porque es la ruta más larga de superadmin (rollback
// manual en cada paso si algo falla a medias).

export default async function superadminTenantCreateRoutes(app) {

  // POST /api/v1/superadmin/tenants
  app.post("/superadmin/tenants", async (req, reply) => {
    const ctx = await requireSuperAdmin(req, reply);
    if (!ctx) return;
    const { admin, requestId } = ctx;

    const parsed = CreateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, "validation_error", parsed.error.issues[0]?.message || "Datos inválidos", requestId);
    }

    const { name, slug, type, regimen_fiscal, sector } = parsed.data;

    const { data: existing } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return fail(reply, 409, "slug_taken", "Ya existe un centro activo con ese slug", requestId);
    }

    const insert = { name, slug };
    if (type) insert.type = type;
    if (regimen_fiscal) insert.regimen_fiscal = regimen_fiscal;
    if (sector) insert.sector = sector;

    const { data: tenant, error } = await admin
      .from("tenants")
      .insert(insert)
      .select("id, slug, name, type, regimen_fiscal, sector, created_at")
      .single();

    if (error) {
      console.error("[superadmin] tenant insert error:", error.message, error.code);
      return fail(reply, 500, "tenant_create_failed", error.message || "No se pudo crear el centro", requestId);
    }

    // Solo los tenants de tipo academia tienen Finanzas > Gastos — sembrar
    // estas filas para standalone/integrado dejaría categorías huérfanas
    // que esa UI nunca llega a mostrar. No bloqueante: si falla, el centro
    // ya se creó y el admin puede añadir categorías a mano en Ajustes.
    if (tenant.type === "academia") {
      const { error: catErr } = await admin
        .from("academia_gastos_categorias")
        .insert(CATEGORIAS_GASTO_PREDEFINIDAS.map((nombre) => ({ tenant_id: tenant.id, nombre, es_predefinida: true })));
      if (catErr) {
        console.error("[superadmin] categorias gasto seed error:", catErr.message);
        req.log.error({ err: catErr, requestId }, "seed categorias gasto failed");
      }
    }

    // ── Crear administrador si se proporcionaron datos ──────────────────────
    const adminData = parsed.data.admin;
    if (!adminData) return ok(reply, { tenant }, requestId);

    let createdUserId = null;
    const rollback = async () => {
      if (createdUserId) {
        const { error: delUserErr } = await admin.auth.admin.deleteUser(createdUserId);
        if (delUserErr) console.error("[rollback] deleteUser failed:", delUserErr.message);
      }
      const { error: delTenantErr } = await admin.from("tenants").delete().eq("id", tenant.id);
      if (delTenantErr) console.error("[rollback] deleteTenant failed:", delTenantErr.message);
    };

    try {
      const displayName = `${adminData.first_name} ${adminData.last_name}`.trim();

      // Pre-check: limpiar usuario previo con este email si no tiene centro activo.
      // Ocurre cuando un centro anterior fue borrado sin purgar su admin,
      // o cuando un intento previo falló a medias.
      const { data: existingUsers } = await admin.rpc(
        "admin_find_user_by_email",
        { p_email: adminData.email }
      );
      const existingUser = existingUsers?.[0] || null;

      if (existingUser) {
        const { data: activeMems } = await admin
          .from("tenant_memberships")
          .select("id, tenant:tenants!inner(id, deleted_at)")
          .eq("user_id", existingUser.user_id)
          .is("tenants.deleted_at", null)
          .limit(1);

        if (activeMems && activeMems.length > 0) {
          await rollback();
          return fail(reply, 409, "email_in_use",
            "Este email ya está en uso por un administrador activo en otro centro.",
            requestId);
        }

        const { error: delErr } = await admin.auth.admin.deleteUser(existingUser.user_id);
        if (delErr) {
          console.error("[superadmin] No se pudo eliminar usuario previo:", delErr.message);
          await rollback();
          return fail(reply, 500, "email_cleanup_failed",
            "El email ya existe en el sistema y no se pudo limpiar. Contacta con soporte.",
            requestId);
        }

        const { data: cleaned } = await admin.rpc(
          "admin_delete_orphaned_identities",
          { p_email: adminData.email }
        );
        if (cleaned?.length) {
          console.warn("[superadmin] Identidades huérfanas eliminadas:", JSON.stringify(cleaned));
        }
      }

      // Contraseña interna aleatoria — el admin la reemplazará via el link de configuración
      const internalPassword = generateTempPassword();

      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: adminData.email,
        password: internalPassword,
        email_confirm: true,
      });
      if (authErr) {
        req.log.error({ err: authErr, requestId }, "admin_user_create_failed: " + authErr.message);
        await rollback();
        return fail(reply, 500, "admin_user_create_failed", authErr.message || "No se pudo crear el usuario admin", requestId);
      }
      createdUserId = authData.user.id;

      const { error: profErr } = await admin.from("profiles").upsert({
        id: createdUserId,
        display_name: displayName,
        phone: adminData.phone || null,
        must_change_password: true,
      }, { onConflict: "id" });
      if (profErr) {
        req.log.error({ err: profErr, requestId }, "profile_create_failed: " + profErr.message);
        await rollback();
        return fail(reply, 500, "profile_create_failed", profErr.message || "No se pudo crear el perfil del admin", requestId);
      }

      const { error: memErr } = await admin.from("tenant_memberships").insert({
        user_id: createdUserId,
        tenant_id: tenant.id,
        role: "admin",
        status: "active",
      });
      if (memErr) {
        req.log.error({ err: memErr, requestId }, "membership_create_failed: " + memErr.message);
        await rollback();
        return fail(reply, 500, "membership_create_failed", memErr.message || "No se pudo asignar el admin al centro", requestId);
      }

      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: adminData.email,
        options: { redirectTo: "https://tutordigital.app/change-password.html" },
      });
      if (linkErr || !linkData?.properties?.action_link) {
        req.log.error({ err: linkErr, requestId }, "generate_link_failed: " + linkErr?.message);
        await rollback();
        return fail(reply, 500, "generate_link_failed",
          "No se pudo generar el enlace de configuración. Inténtalo de nuevo.",
          requestId);
      }

      sendAdminInviteEmail({ to: adminData.email, tenantName: name, setupLink: linkData.properties.action_link })
        .catch(e => console.error("[superadmin] Email invite failed:", e.message));

      return ok(reply, { tenant, admin_created: true }, requestId);
    } catch (err) {
      console.error("[superadmin] create_tenant error:", err?.message, "\n", err?.stack);
      req.log.error({ err, stack: err?.stack, requestId }, "create_tenant_catch: " + err?.message);
      await rollback();
      return fail(reply, 500, "create_failed", err?.message || "Error inesperado al crear el centro", requestId);
    }
  });
}
