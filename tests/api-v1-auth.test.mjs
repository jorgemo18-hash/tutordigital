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

  async function loginAndGetToken(email, password) {
    const res = await inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    const b = body(res);
    if (res.statusCode !== 200) return "";
    return String(b?.data?.access_token || "");
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

  // El flujo está desactivado a propósito (ver access.routes.js: los
  // alumnos se registran desde student-register.html) — devuelve 410 Gone
  // para cualquier POST, incluso sin token, antes de llegar a comprobar
  // auth. No es un 401 de autenticación, es un 410 de "este flujo ya no
  // existe".
  test("/tenant/join without token -> 410 flow disabled", async () => {
    const res = await inject({
      method: "POST",
      url: "/api/v1/tenant/join",
      payload: { join_code: "abcd1234" },
    });
    const b = body(res);
    assert.equal(res.statusCode, 410);
    assert.equal(b?.error?.code, "flow_disabled");
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/tenant/join method not allowed -> 405 standard format", async () => {
    const res = await inject({ method: "GET", url: "/api/v1/tenant/join" });
    const b = body(res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/tenant/join valid code -> membership pending + tenantSlug (conditional)", async () => {
    const email = process.env.TEST_AUTH_EMAIL || "";
    const password = process.env.TEST_AUTH_PASSWORD || "";
    const joinCode = process.env.TEST_TENANT_JOIN_CODE || "";
    const hasSupabaseEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
    if (!email || !password || !joinCode || !hasSupabaseEnv) return;

    const token = await loginAndGetToken(email, password);
    if (!token) return;

    const res = await inject({
      method: "POST",
      url: "/api/v1/tenant/join",
      headers: { authorization: `Bearer ${token}` },
      payload: { join_code: joinCode },
    });
    const b = body(res);
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(b?.data?.tenant?.slug), true);
    assert.equal(b?.data?.role, "student");
    assert.equal(["pending", "approved"].includes(String(b?.data?.approval_status || "")), true);
    assert.equal(Boolean(b?.requestId), true);
  });
}
