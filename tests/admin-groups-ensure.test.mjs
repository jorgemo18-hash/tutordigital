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

  test("admin groups ensure without tenant -> 400 tenant_slug_required", async () => {
    const token = process.env.TEST_ADMIN_AUTH_ACCESS_TOKEN || "";
    if (!token) return;

    const res = await inject({
      method: "POST",
      url: "/api/v1/admin/groups/ensure",
      headers: {
        authorization: `Bearer ${token}`,
        origin: "http://localhost:5173",
      },
      payload: { stage: "primaria", year: 3, track: "A" },
    });

    const b = body(res);
    assert.equal(res.statusCode, 400);
    assert.equal(b?.error?.code, "tenant_slug_required");
    assert.equal(Boolean(b?.requestId), true);
  });

  test("admin groups ensure without auth -> 401", async () => {
    const res = await inject({
      method: "POST",
      url: "/api/v1/admin/groups/ensure",
      headers: {
        "x-ttd-tenant": "demo",
        origin: "http://localhost:5173",
      },
      payload: { stage: "primaria", year: 3, track: "A" },
    });

    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("admin groups ensure with auth non-admin -> 403 (conditional)", async () => {
    const token = process.env.TEST_TEACHER_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const res = await inject({
      method: "POST",
      url: "/api/v1/admin/groups/ensure",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
        origin: "http://localhost:5173",
      },
      payload: { stage: "primaria", year: 3, track: "B" },
    });

    const b = body(res);
    assert.equal(res.statusCode, 403);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("admin groups ensure with admin -> 200 and returns group (conditional)", async () => {
    const token = process.env.TEST_ADMIN_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const track = `Z${Date.now().toString(36).slice(-1)}`.slice(0, 1);
    const res = await inject({
      method: "POST",
      url: "/api/v1/admin/groups/ensure",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
        origin: "http://localhost:5173",
      },
      payload: { stage: "primaria", year: 3, track },
    });

    const b = body(res);
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(b?.data?.id), true);
    assert.equal(Boolean(b?.data?.name), true);
  });

  test("admin groups ensure idempotent for same stage/year/track (conditional)", async () => {
    const token = process.env.TEST_ADMIN_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const payload = {
      stage: "eso",
      year: 2,
      track: "E",
    };

    const first = await inject({
      method: "POST",
      url: "/api/v1/admin/groups/ensure",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
        origin: "http://localhost:5173",
      },
      payload,
    });

    const second = await inject({
      method: "POST",
      url: "/api/v1/admin/groups/ensure",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
        origin: "http://localhost:5173",
      },
      payload,
    });

    const b1 = body(first);
    const b2 = body(second);
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(Boolean(b1?.data?.id), true);
    assert.equal(b1?.data?.id, b2?.data?.id);
  });
}
