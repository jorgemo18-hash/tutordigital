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

  test("teacher/me without auth -> 401", async () => {
    const res = await inject({
      method: "GET",
      url: "/api/v1/teacher/me",
      headers: { "x-ttd-tenant": "demo" },
    });
    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("teacher/me without membership -> 403 (conditional)", async () => {
    const token = process.env.TEST_PENDING_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_PENDING_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const res = await inject({
      method: "GET",
      url: "/api/v1/teacher/me",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
      },
    });

    const b = body(res);
    assert.equal(res.statusCode, 403);
    assert.equal(Boolean(b?.error?.code), true);
  });

  test("teacher/me with membership -> 200 (conditional)", async () => {
    const token = process.env.TEST_TEACHER_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const res = await inject({
      method: "GET",
      url: "/api/v1/teacher/me",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
      },
    });

    const b = body(res);
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(b?.data?.teacher), true);
  });
}
