import assert from "node:assert/strict";

export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  async function inject(req) {
    const app = await createApp();
    try {
      return await app.inject(req);
    } finally {
      await app.close();
    }
  }

  function body(res) {
    try {
      return JSON.parse(res.body || "{}");
    } catch {
      return {};
    }
  }

  test("teacher invite redeem with unknown tenant -> 404 (conditional)", async () => {
    const token = process.env.TEST_INVITE_AUTH_ACCESS_TOKEN || "";
    if (!token) return;
    const unknownTenantSlug = `tenant-${Date.now()}-missing`;

    const res = await inject({
      method: "POST",
      url: "/api/v1/teacher/invite/redeem",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": unknownTenantSlug,
        origin: "http://localhost:5173",
      },
      payload: {},
    });

    const b = body(res);
    assert.equal(res.statusCode, 404);
    assert.equal(String(b?.error?.code || ""), "tenant_not_found");
  });

  test("teacher invite redeem without code payload (email flow) -> no 500 (conditional)", async () => {
    const token = process.env.TEST_INVITE_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const res = await inject({
      method: "POST",
      url: "/api/v1/teacher/invite/redeem",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
        origin: "http://localhost:5173",
      },
      payload: {},
    });

    const b = body(res);
    assert.notEqual(res.statusCode, 500);
    if (res.statusCode === 200) {
      assert.equal(b?.data?.status, "active");
      return;
    }
    assert.equal(Boolean(b?.error?.code), true);
  });
}
