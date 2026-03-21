import {
  DEFAULT_ALLOWED_ORIGINS,
  getAllowedOrigins,
  getEffectiveOrigin,
  matchesAllowedOrigin,
} from "../server/lib/security/origins.js";

export async function run({ test, assert }) {
  test("origins: matches wildcard vercel preview", () => {
    const allowed = getAllowedOrigins({
      env: {
        ALLOWED_ORIGINS: "https://tutordigital.vercel.app,https://tutordigital-*.vercel.app",
      },
    });

    assert.equal(
      matchesAllowedOrigin(
        "https://tutordigital-ehky2e4g0-jorges-projects-07d820fc.vercel.app",
        allowed
      ),
      true
    );
  });

  test("origins: falls back to global default list", () => {
    const allowed = getAllowedOrigins({ env: {} });
    assert.equal(allowed.join(","), DEFAULT_ALLOWED_ORIGINS);
  });

  test("origins: route-specific env overrides global env", () => {
    const allowed = getAllowedOrigins({
      env: {
        ALLOWED_ORIGINS: "https://prod.example",
        CHAT_ALLOWED_ORIGINS: "http://localhost:5173",
      },
      envNames: ["CHAT_ALLOWED_ORIGINS", "ALLOWED_ORIGINS"],
    });

    assert.deepEqual(allowed, ["http://localhost:5173"]);
  });

  test("origins: effective origin falls back to referer", () => {
    assert.equal(
      getEffectiveOrigin({ referer: "https://tutordigital.vercel.app/app.html?x=1" }),
      "https://tutordigital.vercel.app"
    );
  });
}
