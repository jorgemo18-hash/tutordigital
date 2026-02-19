import assert from "node:assert/strict";

export async function run({ test }) {
  const {
    GroupCreateSchema,
    StudentsQuerySchema,
    StudentCreateSchema,
  } = await import("../server/lib/validators.js");
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

  test("groups: create requires name", () => {
    const r = GroupCreateSchema.safeParse({});
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
    const res = await inject({ method: "GET", url: "/api/v1/me" });
    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/me method not allowed -> 405 standard format", async () => {
    const res = await inject({ method: "POST", url: "/api/v1/me" });
    const b = body(res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/groups without token -> 401 standard format", async () => {
    const res = await inject({ method: "GET", url: "/api/v1/groups" });
    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/groups method not allowed -> 405 standard format", async () => {
    const res = await inject({ method: "PUT", url: "/api/v1/groups" });
    const b = body(res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/students without token -> 401 standard format", async () => {
    const res = await inject({ method: "GET", url: "/api/v1/students" });
    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/tasks without token -> 401 standard format", async () => {
    const res = await inject({ method: "GET", url: "/api/v1/tasks" });
    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/tickets without token -> 401 standard format", async () => {
    const res = await inject({ method: "GET", url: "/api/v1/tickets" });
    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/notebook without token -> 401 standard format", async () => {
    const res = await inject({ method: "GET", url: "/api/v1/notebook" });
    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/notebook method not allowed -> 405 standard format", async () => {
    const res = await inject({ method: "PUT", url: "/api/v1/notebook" });
    const b = body(res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/teacher/requests without token -> 401 standard format", async () => {
    const res = await inject({ method: "GET", url: "/api/v1/teacher/requests?status=pending" });
    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/teacher/requests method not allowed -> 405 standard format", async () => {
    const res = await inject({ method: "PUT", url: "/api/v1/teacher/requests" });
    const b = body(res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("/groups with token -> 200 standard format (conditional)", async () => {
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const res = await inject({
      method: "GET",
      url: "/api/v1/groups?limit=10&offset=0",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
      },
    });

    const b = body(res);
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(b?.data), true);
  });

  test("/groups with token accepts limit=500 offset=0 (conditional)", async () => {
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const res = await inject({
      method: "GET",
      url: "/api/v1/groups?limit=500&offset=0",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
      },
    });

    const b = body(res);
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(b?.data), true);
  });

  test("/tasks with pending student token -> 403 student_not_approved (conditional)", async () => {
    const token = process.env.TEST_PENDING_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_PENDING_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const res = await inject({
      method: "GET",
      url: "/api/v1/tasks?limit=5&offset=0",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
      },
    });

    const b = body(res);
    assert.equal(res.statusCode, 403);
    assert.equal(b?.error?.code, "student_not_approved");
  });
}
