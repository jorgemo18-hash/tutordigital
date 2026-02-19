export default async function buildRoutes(app) {
  app.get("/_build", async () => {
    return {
      ok: true,
      ts: Date.now(),
      env: process.env.NODE_ENV || null,
      render_service: process.env.RENDER_SERVICE_NAME || null,
      render_commit:
        process.env.RENDER_GIT_COMMIT ||
        process.env.RENDER_COMMIT ||
        process.env.GIT_COMMIT ||
        null,
    };
  });
}
