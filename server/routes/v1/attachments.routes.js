import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { rateLimit } from "../../lib/rateLimit.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { taskBelongsToStudent } from "../../lib/taskOwnership.js";

const BUCKET = "task-attachments";
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 días en segundos

const ALLOWED_NON_IMAGE_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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

const UploadSchema = z.object({
  task_id: z.string().uuid(),
  file_name: z.string().min(1).max(200),
  mime: z.string().max(100),
  data: z.string().min(1), // base64 o data URL
});

export default async function attachmentsRoutes(app) {
  const tenantMembershipGuard = makeTenantMembershipGuard();

  // POST /api/v1/attachments — profesor o alumno sube un adjunto
  // bodyLimit: MAX_FILE_BYTES (12 MB) × 1.4 base64 overhead + margen → 20 MB
  app.post("/", { bodyLimit: 20 * 1024 * 1024, preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher", "student"],
    });
    if (!auth.ok) return;

    const rl = await rateLimit(req, { limit: 60, windowSec: 60, userId: auth.user.id, tenantId: auth.tenant.id });
    reply.header("x-ratelimit-limit", rl.limit);
    reply.header("x-ratelimit-remaining", rl.remaining);
    if (!rl.ok) return fail(reply, 429, "rate_limited", "Too many requests", requestId);

    const parsed = UploadSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

    const { task_id, file_name, mime, data } = parsed.data;

    if (!mime.startsWith("image/") && !ALLOWED_NON_IMAGE_MIMES.has(mime)) {
      return fail(reply, 415, "unsupported_mime", "Tipo de archivo no soportado.", requestId);
    }

    const base64 = getBase64FromDataUrl(data);
    const bytes = approxBase64Bytes(base64);
    if (bytes > MAX_FILE_BYTES) {
      return fail(reply, 413, "payload_too_large", "El archivo es demasiado grande.", requestId);
    }

    const admin = createSupabaseAdmin();

    if (auth.membership.role === "student") {
      // El alumno solo puede adjuntar a tareas de su grupo, o a sus propias
      // tareas de sistema sin grupo (p.ej. sesión libre) — ver taskOwnership.js.
      const { data: student } = await admin
        .from("students")
        .select("id, group_id")
        .eq("tenant_id", auth.tenant.id)
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!student) {
        return fail(reply, 403, "forbidden", "Estudiante no encontrado.", requestId);
      }

      const owned = await taskBelongsToStudent(admin, { tenantId: auth.tenant.id, taskId: task_id, student });
      if (!owned) {
        return fail(reply, 403, "forbidden", "No tienes permiso para adjuntar a esta tarea.", requestId);
      }
    } else {
      // Admin / teacher: solo verificar que la tarea pertenece al tenant
      const { data: task } = await admin
        .from("tasks")
        .select("id")
        .eq("id", task_id)
        .eq("tenant_id", auth.tenant.id)
        .maybeSingle();

      if (!task) {
        return fail(reply, 404, "task_not_found", "Tarea no encontrada.", requestId);
      }
    }

    const attachmentId = crypto.randomUUID();
    const safeName = file_name.replace(/[^a-zA-Z0-9._\-]/g, "_").slice(0, 100);
    const storagePath = `${auth.tenant.id}/${task_id}/${attachmentId}_${safeName}`;

    const buf = Buffer.from(base64, "base64");
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType: mime, upsert: false });

    if (uploadError) {
      return fail(reply, 500, "upload_failed", "No se pudo subir el archivo.", requestId);
    }

    const { data: att, error: dbError } = await admin
      .from("attachments")
      .insert({
        id: attachmentId,
        tenant_id: auth.tenant.id,
        owner_type: "task",
        owner_id: task_id,
        uploader_id: auth.user.id,
        file_name: file_name.slice(0, 200),
        mime,
        size: bytes,
        storage_path: storagePath,
        role: "statement",
      })
      .select("id, file_name, mime, size, storage_path, created_at")
      .single();

    if (dbError) {
      // Limpiar storage si falla la BD
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      return fail(reply, 500, "db_insert_failed", "No se pudo guardar el adjunto.", requestId);
    }

    return created(reply, att, requestId);
  });

  // GET /api/v1/attachments/:id/signed-url — URL firmada temporal
  app.get("/:id/signed-url", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher", "student"],
    });
    if (!auth.ok) return;

    const id = String(req.params?.id || "").trim();
    if (!id) return fail(reply, 400, "missing_id", "Falta el id del adjunto.", requestId);

    const admin = createSupabaseAdmin();
    const { data: att } = await admin
      .from("attachments")
      .select("id, storage_path, mime, file_name")
      .eq("id", id)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (!att) return fail(reply, 404, "not_found", "Adjunto no encontrado.", requestId);

    const { data: signed, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(att.storage_path, SIGNED_URL_TTL);

    if (error || !signed?.signedUrl) {
      return fail(reply, 500, "signed_url_failed", "No se pudo generar la URL del adjunto.", requestId);
    }

    return ok(reply, { url: signed.signedUrl, mime: att.mime, file_name: att.file_name }, requestId);
  });

  // DELETE /api/v1/attachments/:id
  app.delete("/:id", { preHandler: tenantMembershipGuard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);

    const auth = await requireRole(req, reply, requestId, {
      tenantSlug,
      roles: ["admin", "teacher"],
    });
    if (!auth.ok) return;

    const id = String(req.params?.id || "").trim();
    if (!id) return fail(reply, 400, "missing_id", "Falta el id del adjunto.", requestId);

    const admin = createSupabaseAdmin();
    const { data: att } = await admin
      .from("attachments")
      .select("id, storage_path")
      .eq("id", id)
      .eq("tenant_id", auth.tenant.id)
      .maybeSingle();

    if (!att) return fail(reply, 404, "not_found", "Adjunto no encontrado.", requestId);

    await admin.storage.from(BUCKET).remove([att.storage_path]).catch(() => {});

    await admin
      .from("attachments")
      .delete()
      .eq("id", id)
      .eq("tenant_id", auth.tenant.id);

    return ok(reply, { ok: true }, requestId);
  });
}
