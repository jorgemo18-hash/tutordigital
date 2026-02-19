import Fastify from "fastify";
import { makeTenantMembershipGuard } from "../server/lib/security/tenantMembershipGuard.js";

async function buildApp({ requireAuthFn, resolveTenantForUserFn }) {
  const app = Fastify();
  const guard = makeTenantMembershipGuard({
    requireAuthFn,
    resolveTenantForUserFn,
    getTenantSlugFn: (req) => String(req.headers?.["x-tenant-slug"] || ""),
  });

  app.post("/guarded", { preHandler: guard.preHandler }, async (req, reply) => {
    return reply.code(200).send({ ok: true, data: { pass: true }, requestId: req.requestId || "" });
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
      headers: { "x-tenant-slug": "tenant-a" },
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
      headers: { "x-tenant-slug": "tenant-b" },
      payload: { text: "hola" },
    });
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body || "{}");
    assert.equal(body?.ok, false);
    assert.equal(body?.error?.code, "forbidden_tenant");
    assert.equal(Boolean(body?.requestId), true);
    await app.close();
  });
}
