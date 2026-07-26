import { z } from "zod";
import { makeRequestId } from "../../../lib/requestId.js";
import { fail } from "../../../lib/http.js";
import { requireRole } from "../../../lib/middleware.js";
import { getTenantSlug } from "../../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../../lib/security/tenantMembershipGuard.js";
import { fetchConfig } from "../../../lib/academiaRecibos/consultas.js";
import { fetchFichajesDeTrabajador, fetchNombreTrabajador } from "../../../lib/academiaFichajes/consultas.js";
import { buildFichajesPdfBuffer } from "../../../lib/academiaFichajes/exportPdf.js";
import { buildFichajesExcelBuffer } from "../../../lib/academiaFichajes/exportExcel.js";

const ExportarQuerySchema = z.object({
  worker_profile_id: z.string().uuid(),
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
  formato: z.enum(["pdf", "xlsx"]),
});

// Exportación del listado de un trabajador en un período — mismo dato que
// la vista de gestión (fetchFichajesDeTrabajador), solo cambia el
// formato de salida. Apto para presentar ante una inspección de trabajo:
// original y corrección van siempre por separado (ver exportPdf.js/
// exportExcel.js), nunca fusionados.
export default async function academiaFichajesExportarRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/exportar", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = ExportarQuerySchema.safeParse(req.query || {});
    if (!parsed.success) return fail(reply, 400, "invalid_query", "Invalid query", requestId, { issues: parsed.error.issues });
    const { worker_profile_id: workerProfileId, mes, anio, formato } = parsed.data;

    const admin = createSupabaseAdmin();
    const [{ fichajes, error: fichajesErr }, { nombre: trabajadorNombre, error: nombreErr }, config] = await Promise.all([
      fetchFichajesDeTrabajador(admin, auth.tenant.id, workerProfileId, { mes, anio }),
      fetchNombreTrabajador(admin, auth.tenant.id, auth.tenant.slug, workerProfileId),
      fetchConfig(admin, auth.tenant.id),
    ]);
    if (fichajesErr || nombreErr) {
      req.log.error({ err: fichajesErr || nombreErr, requestId }, "academia fichajes exportar: fetch failed");
      return fail(reply, 500, "fichajes_fetch_failed", "No se pudieron cargar los fichajes.", requestId);
    }

    const academiaNombre = config?.nombre_emisor || auth.tenant.name;
    const nombreArchivo = `Control_horario_${trabajadorNombre.replace(/\s+/g, "_")}_${mes}_${anio}`;

    if (formato === "pdf") {
      const buffer = await buildFichajesPdfBuffer({ academiaNombre, trabajadorNombre, mes, anio, fichajes });
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="${nombreArchivo}.pdf"`);
      return reply.send(buffer);
    }

    const buffer = await buildFichajesExcelBuffer({ academiaNombre, trabajadorNombre, mes, anio, fichajes });
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="${nombreArchivo}.xlsx"`);
    return reply.send(buffer);
  });
}
