import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { convertirHeicBase64 } from "../../lib/academiaFinanzas/heicConverter.js";
import { createAnthropicClient, SONNET_MODEL } from "../../lib/anthropic.js";
import { mapAlumnoFamiliaPlana } from "../../lib/academiaAlumnoHelpers.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif", "image/x-adobe-dng", "image/dng"];
const ExtraerBodySchema = z.object({
  base64: z.string().min(1),
  mediaType: z.enum(MEDIA_TYPES),
});

const EXTRACTION_PROMPT = `Extrae los datos de esta ficha de inscripción de academia. Devuelve SOLO un JSON con estos campos exactos (deja vacío "" si no encuentras el dato con seguridad):
{
  "nombre": "",
  "curso": "",
  "email": "",
  "telefono": "",
  "dni": "",
  "direccion": "",
  "ciudad": "",
  "codigo_postal": "",
  "metodo_pago": "",
  "notas": ""
}

Para metodo_pago usa solo estos valores: "bizum", "transferencia", "efectivo", "sepa". Devuelve solo el JSON, sin explicaciones.`;

// POST /api/v1/academia/inscripciones/extraer — OCR de una ficha de
// inscripción en papel. Llama a Claude directamente desde el backend (sin
// Edge Functions de Supabase, igual que el resto del proyecto).
export default async function academiaInscripcionesRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.post("/extraer", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = ExtraerBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    // HEIC/HEIF/DNG no son soportados por la API de visión — convertir a JPEG.
    // Si el servidor no tiene soporte RAW para DNG, el converter lanza un mensaje claro.
    let base64, mediaType;
    try {
      ({ base64, mediaType } = await convertirHeicBase64(parsed.data.base64, parsed.data.mediaType));
    } catch (err) {
      return fail(reply, 422, "conversion_failed", err.message, requestId);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fail(reply, 500, "missing_key", "AI service not configured", requestId);

    try {
      const client = createAnthropicClient(apiKey);
      const response = await client.messages.create({
        model: SONNET_MODEL,
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
      });

      const text = response.content.find((b) => b.type === "text")?.text || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        req.log.error({ requestId, text }, "academia inscripcion ocr: no JSON in response");
        return fail(reply, 500, "ocr_no_json", "No se pudieron extraer los datos", requestId);
      }

      const datos = JSON.parse(match[0]);
      return ok(reply, datos, requestId);
    } catch (err) {
      req.log.error({ err, requestId }, "academia inscripcion ocr failed");
      return fail(reply, 500, "ocr_failed", err.message || "No se pudieron extraer los datos", requestId);
    }
  });

  // GET /api/v1/academia/inscripciones/pendientes — borradores creados desde
  // OCR (activo=false, fecha_baja=null). Los archivados también tienen
  // activo=false pero SÍ tienen fecha_baja, así que no aparecen aquí.
  app.get("/pendientes", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_alumnos")
      .select("id, nombre, curso, nivel, fecha_alta, created_at, familia:academia_familias(id, nombre, email)")
      .eq("tenant_id", auth.tenant.id)
      .eq("activo", false)
      .is("fecha_baja", null)
      .order("created_at", { ascending: false });

    if (error) {
      req.log.error({ err: error, requestId }, "academia inscripciones pendientes fetch failed");
      return fail(reply, 500, "pendientes_fetch_failed", "Failed to fetch pendientes", requestId);
    }

    // Alumnos "activos" con cuenta creada pero email de auth.users sin
    // confirmar (ver migración 076) — se suman a los borradores de arriba,
    // más recientes primero en cada grupo (no se intercalan por fecha).
    const { data: sinConfirmar, error: sinConfirmarErr } = await admin.rpc(
      "academia_alumnos_pendientes_confirmacion",
      { p_tenant_id: auth.tenant.id }
    );
    if (sinConfirmarErr) {
      req.log.error({ err: sinConfirmarErr, requestId }, "academia inscripciones pendientes confirmacion (rpc) failed");
      return fail(reply, 500, "pendientes_fetch_failed", "Failed to fetch pendientes", requestId);
    }

    const alumnos = [...(data || []), ...sinConfirmar.map(mapAlumnoFamiliaPlana)];
    return ok(reply, { alumnos }, requestId);
  });
}
