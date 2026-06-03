#!/usr/bin/env node
// Genera assets/shared/config/runtime-config.js inyectando variables de entorno.
// Ejecutado por Vercel en el buildCommand antes de servir los estáticos.

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "assets", "shared", "config", "runtime-config.js");

const apiBaseUrl  = process.env.API_BASE_URL  || "https://tutordigital.onrender.com";
const appVersion  = process.env.npm_package_version || "8.0.5";
const sentryDsn   = process.env.SENTRY_DSN    || "";

const content = `window.__TTD_CONFIG__ = {
  API_BASE_URL: ${JSON.stringify(apiBaseUrl)},
  APP_VERSION: ${JSON.stringify(appVersion)},
  BUILD_LABEL: "v${appVersion}",
  SENTRY_DSN: ${JSON.stringify(sentryDsn)},
};

window.RUNTIME_CONFIG = {
  DEBUG_NOTEBOOK: false,
  DEBUG_STUDENT_BOOT: false,
};
`;

writeFileSync(outPath, content, "utf8");
console.log(`[build] runtime-config.js generado (SENTRY_DSN: ${sentryDsn ? "✓ presente" : "⚠ vacía"})`);
