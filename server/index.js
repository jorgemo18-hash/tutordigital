import { createApp } from "./app.js";
import { requireEnv } from "./lib/env.js";
import { startTenantCleanupJob } from "./lib/tenantCleanupJob.js";

const port = Number(process.env.PORT || 10000);
const host = "0.0.0.0";

try {
  if (process.env.NODE_ENV === "production") {
    requireEnv("SUPABASE_URL");
    requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  }
  const app = await createApp();
  await app.listen({ port, host });
  app.log.info(`server listening on ${host}:${port}`);
  startTenantCleanupJob();
} catch (err) {
  console.error(err);
  process.exit(1);
}
