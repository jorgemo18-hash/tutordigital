// Config de Playwright para la suite de UI (regresión visual + smoke).
// Arranca el servidor estático del repo (tests/ui/server/static-server.mjs)
// y sirve todo sin backend real — cada test mockea /api/v1/** por su cuenta
// (ver fixtures/api-mocks.mjs). Ejecutar con `npm run test:ui`.
import { defineConfig, devices } from "@playwright/test";

const PORT = 8934;

export default defineConfig({
  testDir: ".",
  testMatch: ["visual/**/*.spec.mjs", "smoke/**/*.spec.mjs"],
  snapshotDir: "./__screenshots__",
  outputDir: "./.test-results",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
  expect: {
    // Umbral estricto: <0.5% de píxeles distintos tolerados por captura.
    toHaveScreenshot: { maxDiffPixelRatio: 0.005 },
  },
  webServer: {
    command: `node server/static-server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    cwd: new URL(".", import.meta.url).pathname,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
