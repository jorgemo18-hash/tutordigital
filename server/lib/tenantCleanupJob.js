import { createSupabaseAdmin } from "./supabase.js";
import { purgeTenant } from "./superadminTenantPurge.js";

const TTL_DAYS = 30;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // cada 24 horas

async function runCleanup() {
  const admin = createSupabaseAdmin();
  const cutoff = new Date(Date.now() - TTL_DAYS * 86400 * 1000).toISOString();

  const { data: expired, error } = await admin
    .from("tenants")
    .select("id, slug, name")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff);

  if (error) {
    console.error("[cleanup] Failed to query expired tenants:", error.message);
    return;
  }

  if (!expired?.length) return;

  console.log(`[cleanup] Purgando ${expired.length} centro(s) expirado(s) de la papelera`);
  for (const tenant of expired) {
    try {
      const result = await purgeTenant(tenant.id);
      console.log(`[cleanup] Centro ${tenant.slug} eliminado (${result.deletedUsers} usuarios)`);
    } catch (err) {
      console.error(`[cleanup] Error al purgar ${tenant.slug}:`, err.message);
    }
  }
}

/**
 * Inicia el job de limpieza automática de la papelera.
 * Se ejecuta 60 s después del arranque y luego cada 24 h.
 */
export function startTenantCleanupJob() {
  setTimeout(runCleanup, 60_000);
  setInterval(runCleanup, CHECK_INTERVAL_MS);
  console.log("[cleanup] Job de papelera iniciado (TTL: 30 días, check: cada 24 h)");
}
