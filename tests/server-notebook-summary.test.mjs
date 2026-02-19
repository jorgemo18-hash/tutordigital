import assert from "node:assert/strict";

function todayRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  return { from, to };
}

export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  test("notebook summary GET without token -> 401", async () => {
    const app = await createApp();
    const { from, to } = todayRange();
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/notebook/summary?group_id=00000000-0000-0000-0000-000000000000&from=${from}&to=${to}`,
    });
    assert.equal(res.statusCode, 401);
    await app.close();
  });

  test("notebook summary PUT -> 405", async () => {
    const app = await createApp();
    const { from, to } = todayRange();
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/notebook/summary?group_id=00000000-0000-0000-0000-000000000000&from=${from}&to=${to}`,
    });
    assert.equal(res.statusCode, 405);
    await app.close();
  });

  test("notebook summary GET -> 200 (conditional)", async () => {
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;
    const app = await createApp();
    const { from, to } = todayRange();
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/notebook/summary?group_id=${groupId}&from=${from}&to=${to}`,
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(Boolean(body?.data?.students), true);
    await app.close();
  });
}
