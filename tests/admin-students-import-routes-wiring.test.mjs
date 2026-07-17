import assert from "node:assert/strict";

export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  test("admin students import wiring: preview y confirmación existen (no 404) y exigen auth", async () => {
    const app = await createApp();
    const previewRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/groups/g1/students/import/preview",
      payload: { filename: "a.csv", data: "Tm9tYnJlLEVtYWls" },
    });
    const confirmRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/groups/g1/students/import",
      payload: { rows: [{ email: "a@a.com", name: "A" }] },
    });
    await app.close();

    for (const res of [previewRes, confirmRes]) {
      assert.notEqual(res.statusCode, 404);
      assert.ok([401, 403].includes(res.statusCode));
      const body = JSON.parse(res.body || "{}");
      assert.equal(Boolean(body?.error?.code), true);
      assert.equal(Boolean(body?.requestId), true);
    }
  });
}
