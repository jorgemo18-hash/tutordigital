import assert from "node:assert/strict";

export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  function withEnv(overrides, fn) {
    const previous = {};
    for (const key of Object.keys(overrides)) {
      previous[key] = process.env[key];
      process.env[key] = String(overrides[key]);
    }
    return Promise.resolve()
      .then(fn)
      .finally(() => {
        for (const key of Object.keys(overrides)) {
          if (previous[key] == null) delete process.env[key];
          else process.env[key] = previous[key];
        }
      });
  }

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

  test("fastify /api/v1/chat POST invalid origin -> 403", async () => {
    await withEnv(
      {
        CHAT_ALLOWED_ORIGINS: "http://localhost:5173",
      },
      async () => {
        const app = await createApp();
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/chat",
          headers: {
            origin: "http://localhost:3000",
          },
          payload: { text: "hola" },
        });
        assert.equal(res.statusCode, 403);
        const body = JSON.parse(res.body || "{}");
        assert.equal(body?.ok, false);
        assert.equal(body?.error?.code, "forbidden_origin");
        await app.close();
      }
    );
  });

  test("fastify /api/v1/chat POST rate limited -> 429", async () => {
    await withEnv(
      {
        CHAT_RATE_MAX: "2",
        CHAT_RATE_WINDOW_MS: "60000",
      },
      async () => {
        const app = await createApp();
        const req = {
          method: "POST",
          url: "/api/v1/chat",
          headers: {
            "x-ttd-tenant": "tenant-a",
            "x-forwarded-for": "203.0.113.7",
          },
          payload: {},
        };

        const r1 = await app.inject(req);
        const r2 = await app.inject(req);
        const r3 = await app.inject(req);

        assert.equal(r1.statusCode, 400);
        assert.equal(r2.statusCode, 400);
        assert.equal(r3.statusCode, 429);
        const body = JSON.parse(r3.body || "{}");
        assert.equal(body?.ok, false);
        assert.equal(body?.error?.code, "rate_limited");
        await app.close();
      }
    );
  });
}
