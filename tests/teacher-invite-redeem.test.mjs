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

  test("teacher invite redeem wrong code -> 400 (conditional)", async () => {
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
      payload: { code: "WRONG-CODE" },
    });

    const b = body(res);
    assert.equal(res.statusCode, 400);
    assert.equal(Boolean(b?.error?.code), true);
  });

  test("teacher invite redeem ok -> 200 (conditional)", async () => {
    const token = process.env.TEST_INVITE_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const code = process.env.TEST_TEACHER_REDEEM_CODE || "";
    if (!token || !tenantSlug || !code) return;

    const res = await inject({
      method: "POST",
      url: "/api/v1/teacher/invite/redeem",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
        origin: "http://localhost:5173",
      },
      payload: { code },
    });

    const b = body(res);
    assert.equal(res.statusCode, 200);
    assert.equal(b?.data?.status, "active");
  });
}
