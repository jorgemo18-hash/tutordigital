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

  test("/auth/login invalid body -> 400 standard format", async () => {
    const res = await inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "x", password: "" },
    });

    const b = body(res);
    assert.equal(res.statusCode, 400);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/auth/login method not allowed -> 405 standard format", async () => {
    const res = await inject({ method: "GET", url: "/api/v1/auth/login" });
    const b = body(res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/auth/logout without token -> 401 standard format", async () => {
    const res = await inject({ method: "POST", url: "/api/v1/auth/logout" });
    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/auth/logout method not allowed -> 405 standard format", async () => {
    const res = await inject({ method: "GET", url: "/api/v1/auth/logout" });
    const b = body(res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/auth/login invalid credentials -> 401 standard format (conditional)", async () => {
    const hasSupabaseEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
    if (!hasSupabaseEnv) return;

    const res = await inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "noexiste@example.com", password: "wrong-pass-123" },
    });

    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/auth/login happy path (requires env + credentials)", async () => {
    const email = process.env.TEST_AUTH_EMAIL || "";
    const password = process.env.TEST_AUTH_PASSWORD || "";
    const hasSupabaseEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
    if (!email || !password || !hasSupabaseEnv) return;

    const res = await inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });

    const b = body(res);
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(b?.data?.access_token), true);
    assert.equal(Boolean(b?.requestId), true);
  });
}
