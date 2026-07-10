import { createApp } from "./app.js";
import { validateStartupEnv } from "./lib/env.js";
import { startTenantCleanupJob } from "./lib/tenantCleanupJob.js";
import { initSentry, Sentry } from "./lib/sentry.js";

validateStartupEnv();
initSentry();

process.on("uncaughtException", (err) => {
  Sentry.captureException(err);
  console.error("[uncaughtException]", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  Sentry.captureException(reason);
  console.error("[unhandledRejection]", reason);
});

const port = Number(process.env.PORT || 10000);
const host = "0.0.0.0";

try {
  const app = await createApp();
  await app.listen({ port, host });
  app.log.info(`server listening on ${host}:${port}`);
  startTenantCleanupJob();
} catch (err) {
  console.error(err);
  process.exit(1);
}
