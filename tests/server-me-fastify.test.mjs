import assert from "node:assert/strict";

export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  test("fastify /api/v1/me POST -> 405", async () => {
    const app = await createApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/me",
    });
    assert.equal(res.statusCode, 405);
    await app.close();
  });

  test("fastify /api/v1/me OPTIONS is not 405", async () => {
    const app = await createApp();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/me",
      headers: {
        origin: "https://tutordigital-rosy.vercel.app",
        "access-control-request-method": "GET",
      },
    });
    assert.notEqual(res.statusCode, 405);
    await app.close();
  });
}
