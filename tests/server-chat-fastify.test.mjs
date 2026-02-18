import assert from "node:assert/strict";

export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  test("fastify /api/v1/chat GET -> 405", async () => {
    const app = await createApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/chat",
    });
    assert.equal(res.statusCode, 405);
    await app.close();
  });

  test("fastify /api/v1/chat PUT -> 405", async () => {
    const app = await createApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/chat",
    });
    assert.equal(res.statusCode, 405);
    await app.close();
  });

  test("fastify /api/v1/chat POST invalid body -> 400", async () => {
    const app = await createApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat",
      payload: {},
    });
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body || "{}");
    assert.equal(body?.error?.code, "missing_text_or_file");
    assert.equal(body?.ok, false);
    assert.equal(Boolean(body?.requestId), true);
    await app.close();
  });

  test("fastify /api/v1/chat POST happy path -> 200 (conditional)", async () => {
    if (!process.env.OPENAI_API_KEY) return;
    const app = await createApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat",
      payload: {
        messages: [{ role: "user", content: "Hola, ayúdame con una ecuación sencilla." }],
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body || "{}");
    assert.equal(body?.ok, true);
    assert.equal(typeof body?.data?.reply, "string");
    await app.close();
  });
}
