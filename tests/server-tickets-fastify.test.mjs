import assert from "node:assert/strict";
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

async function buildApp() {
  const app = Fastify();
  const security = makeRouteSecurity({
    env: process.env,
    allowedOriginsEnv: "CHAT_ALLOWED_ORIGINS",
    rateWindowMsEnv: "TICKETS_RATE_WINDOW_MS",
    rateMaxEnv: "TICKETS_RATE_MAX",
    routeName: "tickets",
  });

  app.post(
    "/api/v1/tickets",
    { preHandler: security.preHandler },
    async (req, reply) => {
      const requestId = req.requestId || "";
      return reply.code(200).send({
        ok: true,
        data: { id: "t1" },
        requestId,
      });
    }
  );
  await app.ready();
  return app;
}

export async function run({ test }) {
  test("fastify /api/v1/tickets POST invalid origin -> 403", async () => {
    await withEnv(
      {
        CHAT_ALLOWED_ORIGINS: "http://localhost:5173",
      },
      async () => {
        const app = await buildApp();
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/tickets",
          headers: {
            origin: "http://evil.example",
          },
          payload: { title: "hola" },
        });
        assert.equal(res.statusCode, 403);
        const body = JSON.parse(res.body || "{}");
        assert.equal(body?.ok, false);
        assert.equal(body?.error?.code, "forbidden_origin");
        assert.equal(Boolean(body?.requestId), true);
        await app.close();
      }
    );
  });

  test("fastify /api/v1/tickets POST rate limited -> 429", async () => {
    await withEnv(
      {
        CHAT_ALLOWED_ORIGINS: "http://localhost:5173",
        TICKETS_RATE_MAX: "2",
        TICKETS_RATE_WINDOW_MS: "60000",
      },
      async () => {
        const app = await buildApp();
        const req = {
          method: "POST",
          url: "/api/v1/tickets",
          headers: {
            origin: "http://localhost:5173",
            "x-ttd-tenant": "tenant-a",
            "x-forwarded-for": "203.0.113.7",
          },
          payload: { title: "hola" },
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
        assert.equal(Boolean(body?.requestId), true);
        await app.close();
      }
    );
  });
}
