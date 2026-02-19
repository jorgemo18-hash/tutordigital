import assert from "node:assert/strict";

export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  test("admin teachers wiring: GET /api/v1/admin/teachers exists (no 404)", async () => {
    const app = await createApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/teachers",
    });
    await app.close();

    assert.notEqual(res.statusCode, 404);
    assert.ok([401, 403].includes(res.statusCode));
    const body = JSON.parse(res.body || "{}");
    assert.equal(Boolean(body?.error?.code), true);
    assert.equal(Boolean(body?.requestId), true);
  });
}
