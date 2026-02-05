import assert from "node:assert/strict";

export async function run({ test }) {
  const {
    GroupCreateSchema,
    StudentsQuerySchema,
    StudentCreateSchema,
  } = await import("../api/v1/_lib/validators.js");

  const { default: meHandler } = await import("../api/v1/me.js");
  const { default: groupsHandler } = await import("../api/v1/groups.js");
  const { createSupabaseUserClient } = await import("../api/v1/_lib/supabase.js");

  test("groups: create requires name", () => {
    const r = GroupCreateSchema.safeParse({ });
    assert.equal(r.success, false);
  });

  test("students: create requires display_name", () => {
    const r = StudentCreateSchema.safeParse({ group_id: "11111111-1111-1111-1111-111111111111" });
    assert.equal(r.success, false);
  });

  test("students: query pagination defaults", () => {
    const r = StudentsQuerySchema.safeParse({});
    assert.equal(r.success, true);
    assert.equal(r.data.limit, 50);
    assert.equal(r.data.offset, 0);
  });

  test("/me without token -> 401 standard format", async () => {
    const res = createMockRes();
    await meHandler({ method: "GET", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/me method not allowed -> 405 standard format", async () => {
    const res = createMockRes();
    await meHandler({ method: "POST", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/me with token -> 200 standard format", async () => {
    const directToken = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const email = process.env.TEST_AUTH_EMAIL || "";
    const password = process.env.TEST_AUTH_PASSWORD || "";
    const hasSupabaseEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

    let token = directToken;
    if (!token && email && password && hasSupabaseEnv) {
      const client = createSupabaseUserClient();
      const { data } = await client.auth.signInWithPassword({ email, password });
      token = data?.session?.access_token || "";
    }

    if (!token) return;

    const res = createMockRes();
    await meHandler(
      { method: "GET", headers: { authorization: `Bearer ${token}` }, query: {} },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(res.body?.data?.user?.id), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/groups without token -> 401 standard format", async () => {
    const res = createMockRes();
    await groupsHandler({ method: "GET", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/groups with token -> 200 standard format (conditional)", async () => {
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;
    const res = createMockRes();
    await groupsHandler(
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        query: { limit: "10", offset: "0" },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(res.body?.data), true);
  });

  test("/groups create invalid body -> 400 standard format (conditional)", async () => {
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;
    const res = createMockRes();
    await groupsHandler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: { name: "" },
      },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.equal(Boolean(res.body?.error?.code), true);
  });

  test("/groups create ok -> 201 standard format (conditional)", async () => {
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;
    const res = createMockRes();
    const name = `Grupo Test ${Date.now()}`;
    await groupsHandler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: { name, level: "eso" },
      },
      res
    );
    assert.equal(res.statusCode, 201);
    assert.equal(Boolean(res.body?.data?.id), true);
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
