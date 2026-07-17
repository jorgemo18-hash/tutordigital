import assert from "node:assert/strict";

export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  test("admin students unified wiring: GET /api/v1/admin/students/unified exists (no 404)", async () => {
    const app = await createApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/students/unified",
    });
    await app.close();

    assert.notEqual(res.statusCode, 404);
    assert.ok([401, 403].includes(res.statusCode));
    const body = JSON.parse(res.body || "{}");
    assert.equal(Boolean(body?.error?.code), true);
    assert.equal(Boolean(body?.requestId), true);
  });

  test("admin students unified: with auth but missing tenant is 4xx (not 500) (conditional)", async () => {
    const token = process.env.TEST_ADMIN_AUTH_ACCESS_TOKEN || "";
    if (!token) return;

    const app = await createApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/students/unified",
      headers: { authorization: `Bearer ${token}` },
    });
    await app.close();

    assert.notEqual(res.statusCode, 500);
    assert.ok([400, 403].includes(res.statusCode));
  });

  test("admin students unified: with auth + tenant returns 200 and derived items shape (conditional)", async () => {
    const token = process.env.TEST_ADMIN_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const app = await createApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/students/unified",
      headers: { authorization: `Bearer ${token}`, "x-ttd-tenant": tenantSlug },
    });
    await app.close();

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body || "{}");
    const data = body?.data || {};
    assert.equal(Array.isArray(data?.items), true);
    assert.equal(Array.isArray(data?.groups), true);
  });
}
