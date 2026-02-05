import assert from "node:assert/strict";

export async function run({ test }) {
  const { default: loginHandler } = await import("../api/v1/auth/login.js");
  const { default: logoutHandler } = await import("../api/v1/auth/logout.js");

  test("/auth/login invalid body -> 400 standard format", async () => {
    const res = createMockRes();
    await loginHandler({ method: "POST", headers: {}, body: { email: "bad" } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/auth/login method not allowed -> 405 standard format", async () => {
    const res = createMockRes();
    await loginHandler({ method: "GET", headers: {}, body: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/auth/logout without token -> 401 standard format", async () => {
    const res = createMockRes();
    await logoutHandler({ method: "POST", headers: {}, body: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/auth/logout method not allowed -> 405 standard format", async () => {
    const res = createMockRes();
    await logoutHandler({ method: "GET", headers: {}, body: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/auth/login invalid credentials -> 401 standard format", async () => {
    const hasEnv = Boolean(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const email = process.env.TEST_AUTH_INVALID_EMAIL || "";
    const password = process.env.TEST_AUTH_INVALID_PASSWORD || "";
    if (!hasEnv || !email || !password) return;

    const res = createMockRes();
    await loginHandler(
      { method: "POST", headers: {}, body: { email, password } },
      res
    );
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/auth/login happy path (requires env + credentials)", async () => {
    const email = process.env.TEST_AUTH_EMAIL || "";
    const password = process.env.TEST_AUTH_PASSWORD || "";
    if (!email || !password) return;
    const res = createMockRes();
    await loginHandler(
      { method: "POST", headers: {}, body: { email, password } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(res.body?.data?.access_token), true);
  });
}

function createMockRes() {
  const res = {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}
