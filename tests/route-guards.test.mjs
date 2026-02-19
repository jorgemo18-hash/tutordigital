import Fastify from "fastify";
import { makeRouteSecurity } from "../server/lib/security/routeGuards.js";

function withEnv(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = String(overrides[key]);
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(overrides)) {
        if (previous[key] == null) delete process.env[key];
        else process.env[key] = previous[key];
      }
    });
}

async function buildGuardedApp() {
  const app = Fastify();
  const security = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "CHAT_ALLOWED_ORIGINS",
    rateWindowMsEnv: "TICKETS_RATE_WINDOW_MS",
    rateMaxEnv: "TICKETS_RATE_MAX",
    routeName: "route-guards-test",
  });

  app.post("/guarded", { preHandler: security.preHandler }, async (req, reply) => {
    return reply.code(200).send({ ok: true, requestId: req.requestId || "" });
  });
  await app.ready();
  return app;
}

export async function run({ test, assert }) {
  test("routeGuards: makeRouteSecurity exposes preHandler", () => {
    const out = makeRouteSecurity({ env: process.env, routeName: "unit" });
    assert.equal(typeof out?.preHandler, "function");
  });

  test("routeGuards: invalid origin -> 403 forbidden_origin", async () => {
    await withEnv(
      {
        CHAT_ALLOWED_ORIGINS: "http://localhost:5173",
      },
      async () => {
        const app = await buildGuardedApp();
        const res = await app.inject({
          method: "POST",
          url: "/guarded",
          headers: { origin: "http://evil.example" },
          payload: { text: "hola" },
        });
        assert.equal(res.statusCode, 403);
        const body = JSON.parse(res.body || "{}");
        assert.equal(body?.ok, false);
        assert.equal(body?.error?.code, "forbidden_origin");
        await app.close();
      }
    );
  });

  test("routeGuards: rate limit -> 429 rate_limited", async () => {
    await withEnv(
      {
        CHAT_ALLOWED_ORIGINS: "http://localhost:5173",
        TICKETS_RATE_MAX: "2",
        TICKETS_RATE_WINDOW_MS: "60000",
      },
      async () => {
        const app = await buildGuardedApp();
        const req = {
          method: "POST",
          url: "/guarded",
          headers: {
            origin: "http://localhost:5173",
            "x-forwarded-for": "203.0.113.9",
            "x-ttd-tenant": "tenant-a",
          },
          payload: { text: "hola" },
        };

        const r1 = await app.inject(req);
        const r2 = await app.inject(req);
        const r3 = await app.inject(req);

        assert.equal(r1.statusCode, 200);
        assert.equal(r2.statusCode, 200);
        assert.equal(r3.statusCode, 429);
        const body = JSON.parse(r3.body || "{}");
        assert.equal(body?.ok, false);
        assert.equal(body?.error?.code, "rate_limited");
        await app.close();
      }
    );
  });
}
