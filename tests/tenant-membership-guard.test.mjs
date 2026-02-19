import Fastify from "fastify";
import { makeTenantMembershipGuard } from "../server/lib/security/tenantMembershipGuard.js";

async function buildApp({ requireAuthFn, resolveTenantForUserFn }) {
  const app = Fastify();
  const guard = makeTenantMembershipGuard({
    requireAuthFn,
    resolveTenantForUserFn,
    getTenantSlugFn: (req) => String(req.headers?.["x-ttd-tenant"] || ""),
  });

  app.post("/guarded", { preHandler: guard.preHandler }, async (req, reply) => {
    return reply.code(200).send({ ok: true, data: { pass: true }, requestId: req.requestId || "" });
  });
  app.get("/guarded-summary", { preHandler: guard.preHandler }, async (req, reply) => {
    return reply.code(200).send({ ok: true, data: { q: req.query || {} }, requestId: req.requestId || "" });
  });

  await app.ready();
  return app;
}

export async function run({ test, assert }) {
  test("tenantMembershipGuard: tenant válido y user miembro -> no 403", async () => {
    const app = await buildApp({
      requireAuthFn: async () => ({ ok: true, user: { id: "u1" } }),
      resolveTenantForUserFn: async () => ({ ok: true, tenant: { id: "t1", slug: "a" } }),
    });

    const res = await app.inject({
      method: "POST",
      url: "/guarded",
      headers: { "x-ttd-tenant": "tenant-a" },
      payload: { text: "hola" },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body || "{}");
    assert.equal(body?.ok, true);
    await app.close();
  });

  test("tenantMembershipGuard: tenant inválido para user -> 403 forbidden_tenant", async () => {
    const app = await buildApp({
      requireAuthFn: async () => ({ ok: true, user: { id: "u1" } }),
      resolveTenantForUserFn: async () => ({ ok: false, status: 403, error: "tenant_forbidden" }),
    });

    const res = await app.inject({
      method: "POST",
      url: "/guarded",
      headers: { "x-ttd-tenant": "tenant-b" },
      payload: { text: "hola" },
    });
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body || "{}");
    assert.equal(body?.ok, false);
    assert.equal(body?.error?.code, "forbidden_tenant");
    assert.equal(Boolean(body?.requestId), true);
    await app.close();
  });

  test("tenantMembershipGuard: sin header tenant mantiene comportamiento actual", async () => {
    const app = await buildApp({
      requireAuthFn: async () => ({ ok: true, user: { id: "u1" } }),
      resolveTenantForUserFn: async () => ({ ok: false, status: 403, error: "tenant_forbidden" }),
    });

    const res = await app.inject({
      method: "GET",
      url: "/guarded-summary?from=2026-01-01&to=2026-01-31",
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body || "{}");
    assert.equal(body?.ok, true);
    await app.close();
  });

  test("tenantMembershipGuard: GET con query y tenant inválido -> 403 forbidden_tenant", async () => {
    const app = await buildApp({
      requireAuthFn: async () => ({ ok: true, user: { id: "u1" } }),
      resolveTenantForUserFn: async () => ({ ok: false, status: 403, error: "tenant_forbidden" }),
    });

    const res = await app.inject({
      method: "GET",
      url: "/guarded-summary?from=2026-01-01&to=2026-01-31",
      headers: { "x-ttd-tenant": "tenant-b" },
    });
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body || "{}");
    assert.equal(body?.ok, false);
    assert.equal(body?.error?.code, "forbidden_tenant");
    await app.close();
  });
}
