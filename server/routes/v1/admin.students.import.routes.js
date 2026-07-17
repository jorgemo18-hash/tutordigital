import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeRouteSecurity } from "../../lib/security/routeGuards.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { getBuildInfo } from "../../lib/version.js";
import { ImportPreviewSchema, ImportConfirmSchema, GroupParamsSchema } from "../../lib/adminStudentHelpers.js";
import { buildStudentImportPreview, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from "../../lib/studentImportPreview.js";
import { confirmStudentImport } from "../../lib/studentImportConfirm.js";

// Import masivo de alumnos (Excel/CSV) en dos fases — archivo nuevo en vez
// de añadir a admin.students.routes.js (que ya rozaba las 400 líneas):
//   1. POST .../import/preview — parsea y valida, NO persiste nada y NO
//      manda ningún email (garantía documentada en studentImportPreview.js).
//   2. POST .../import — crea una invitación (+ email) por cada fila que el
//      admin seleccionó en la revisión. Extiende el mismo endpoint que ya
//      existía en este path (antes solo aceptaba {emails:[...]} sin nombres
//      ni fase de revisión) en vez de crear uno paralelo — ver el comentario
//      en admin.students.routes.js donde vivía antes.

// Mismo patrón que attachments.routes.js (archivo en base64/data-URL en el
// body JSON) — el proyecto no usa @fastify/multipart en ningún otro sitio.
function approxBase64Bytes(b64 = "") {
  const s = String(b64 || "");
  const padding = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - padding;
}

function getBase64FromDataUrl(input = "") {
  const s = String(input || "").trim();
  const idx = s.indexOf("base64,");
  if (idx !== -1) return s.slice(idx + 7).replace(/\s/g, "");
  return s.replace(/\s/g, "");
}

async function assertGroupBelongsToTenant(admin, tenantId, groupId, reply, requestId) {
  const { data, error } = await admin
    .from("groups")
    .select("id, name")
    .eq("id", groupId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) { fail(reply, 500, "group_lookup_failed", "Failed to lookup group", requestId); return null; }
  if (!data)  { fail(reply, 404, "group_not_found", "Group not found", requestId); return null; }
  return data;
}

const PREVIEW_ERROR_MESSAGES = {
  file_too_large: "El archivo supera el tamaño máximo permitido (2 MB).",
  unsupported_file_type: "Formato no soportado: usa un archivo .csv o .xlsx.",
  corrupt_file: "No se pudo leer el archivo. Comprueba que no esté dañado.",
  lookup_failed: "No se pudo comprobar los alumnos ya existentes del centro.",
  empty_file: "El archivo está vacío.",
  no_data_rows: "El archivo no tiene filas con datos.",
  columns_not_found: 'No se encontraron las columnas de nombre y email. Se esperaba una columna como "Nombre" y otra como "Email".',
  too_many_rows: `El archivo supera el máximo de ${IMPORT_MAX_ROWS} filas.`,
};

export default async function adminStudentsImportRoutes(app) {
  const createSecurity = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "ALLOWED_ORIGINS",
    rateWindowMsEnv: "ADMIN_STUDENTS_RATE_WINDOW_MS",
    rateMaxEnv: "ADMIN_STUDENTS_RATE_MAX",
    routeName: "admin-students-import",
  });
  const tenantMembershipGuard = makeTenantMembershipGuard();

  // ── POST /admin/groups/:groupId/students/import/preview ─────────────────
  app.post(
    "/admin/groups/:groupId/students/import/preview",
    { bodyLimit: 3 * 1024 * 1024, preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = GroupParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

      const parsed = ImportPreviewSchema.safeParse(req.body || {});
      if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

      const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, parsedParams.data.groupId, reply, requestId);
      if (!group) return;

      const base64 = getBase64FromDataUrl(parsed.data.data);
      if (approxBase64Bytes(base64) > IMPORT_MAX_BYTES) {
        return fail(reply, 413, "file_too_large", PREVIEW_ERROR_MESSAGES.file_too_large, requestId);
      }
      const buffer = Buffer.from(base64, "base64");

      const result = await buildStudentImportPreview({
        admin,
        tenantId: auth.tenant.id,
        buffer,
        filename: parsed.data.filename,
      });

      if (result.error) {
        const message = PREVIEW_ERROR_MESSAGES[result.error] || "No se pudo procesar el archivo.";
        return fail(reply, 400, result.error, message, requestId, {
          expected: result.expected,
          max: result.max,
          received: result.received,
        });
      }

      return ok(reply, { rows: result.rows }, requestId);
    }
  );

  // ── POST /admin/groups/:groupId/students/import ─ confirmación ──────────
  app.post(
    "/admin/groups/:groupId/students/import",
    { preHandler: [createSecurity.preHandler, tenantMembershipGuard.preHandler] },
    async (req, reply) => {
      const requestId = req.requestId || makeRequestId();
      const tenantSlug = getTenantSlug(req);
      reply.header("x-ttd-version", getBuildInfo().label);

      const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
      if (!auth.ok) return;

      const parsedParams = GroupParamsSchema.safeParse(req.params || {});
      if (!parsedParams.success) return fail(reply, 400, "invalid_params", "Invalid params", requestId);

      const parsed = ImportConfirmSchema.safeParse(req.body || {});
      if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });

      const rl = await rateLimit(req, { limit: 20, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
      reply.header("x-ratelimit-limit", rl.limit);
      reply.header("x-ratelimit-remaining", rl.remaining);
      if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

      const admin = createSupabaseAdmin();
      const group = await assertGroupBelongsToTenant(admin, auth.tenant.id, parsedParams.data.groupId, reply, requestId);
      if (!group) return;

      const result = await confirmStudentImport({
        admin,
        tenantId: auth.tenant.id,
        tenantSlug: auth.tenant.slug,
        tenantName: auth.tenant.name,
        groupId: parsedParams.data.groupId,
        groupName: group.name,
        createdBy: auth.user.id,
        rows: parsed.data.rows,
      });

      return created(reply, result, requestId);
    }
  );
}
