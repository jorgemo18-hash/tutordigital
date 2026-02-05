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

  test("/groups method not allowed -> 405 standard format", async () => {
    const res = createMockRes();
    await groupsHandler({ method: "PUT", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 405);
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

  test("/students without token -> 401 standard format", async () => {
    const { default: studentsHandler } = await import("../api/v1/students.js");
    const res = createMockRes();
    await studentsHandler({ method: "GET", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/students method not allowed -> 405 standard format", async () => {
    const { default: studentsHandler } = await import("../api/v1/students.js");
    const res = createMockRes();
    await studentsHandler({ method: "PUT", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/students get 200 (conditional)", async () => {
    const { default: studentsHandler } = await import("../api/v1/students.js");
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;
    const res = createMockRes();
    await studentsHandler(
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        query: { group_id: groupId, limit: "10", offset: "0" },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(res.body?.data?.items), true);
  });

  test("/students create ok -> 201 (conditional)", async () => {
    const { default: studentsHandler } = await import("../api/v1/students.js");
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;
    const res = createMockRes();
    await studentsHandler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: { display_name: `Alumno Test ${Date.now()}`, group_id: groupId },
      },
      res
    );
    assert.equal(res.statusCode, 201);
    assert.equal(Boolean(res.body?.data?.id), true);
  });

  test("/students patch ok -> 200 (conditional)", async () => {
    const { default: studentsHandler } = await import("../api/v1/students.js");
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;
    const createRes = createMockRes();
    await studentsHandler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: { display_name: `Alumno Patch ${Date.now()}`, group_id: groupId },
      },
      createRes
    );
    const studentId = createRes.body?.data?.id;
    if (!studentId) return;
    const res = createMockRes();
    await studentsHandler(
      {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: { id: studentId, display_name: "Alumno Actualizado" },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.data?.id, studentId);
  });

  test("/tasks without token -> 401 standard format", async () => {
    const { default: tasksHandler } = await import("../api/v1/tasks.js");
    const res = createMockRes();
    await tasksHandler({ method: "GET", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/tasks method not allowed -> 405 standard format", async () => {
    const { default: tasksHandler } = await import("../api/v1/tasks.js");
    const res = createMockRes();
    await tasksHandler({ method: "PUT", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/tasks get 200 (conditional)", async () => {
    const { default: tasksHandler } = await import("../api/v1/tasks.js");
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;
    const res = createMockRes();
    await tasksHandler(
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        query: { group_id: groupId, limit: "10", offset: "0" },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(res.body?.data?.items), true);
  });

  test("/tasks create ok -> 201 (conditional)", async () => {
    const { default: tasksHandler } = await import("../api/v1/tasks.js");
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;
    const res = createMockRes();
    await tasksHandler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: {
          group_id: groupId,
          type: "homework",
          title: `Tarea Test ${Date.now()}`,
          desc: "descripcion",
          due_date: "2030-01-01",
        },
      },
      res
    );
    assert.equal(res.statusCode, 201);
    assert.equal(Boolean(res.body?.data?.id), true);
  });

  test("/tasks patch ok -> 200 (conditional)", async () => {
    const { default: tasksHandler } = await import("../api/v1/tasks.js");
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;
    const createRes = createMockRes();
    await tasksHandler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: {
          group_id: groupId,
          type: "homework",
          title: `Tarea Patch ${Date.now()}`,
          desc: "descripcion",
          due_date: "2030-01-02",
        },
      },
      createRes
    );
    const taskId = createRes.body?.data?.id;
    if (!taskId) return;
    const res = createMockRes();
    await tasksHandler(
      {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: { id: taskId, title: "Tarea Actualizada" },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.data?.id, taskId);
  });

  test("/tasks delete ok -> 200 (conditional)", async () => {
    const { default: tasksHandler } = await import("../api/v1/tasks.js");
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;
    const createRes = createMockRes();
    await tasksHandler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: {
          group_id: groupId,
          type: "homework",
          title: `Tarea Delete ${Date.now()}`,
          desc: "descripcion",
          due_date: "2030-01-03",
        },
      },
      createRes
    );
    const taskId = createRes.body?.data?.id;
    if (!taskId) return;
    const res = createMockRes();
    await tasksHandler(
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: { id: taskId },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.data?.ok, true);
  });

  test("/tickets without token -> 401 standard format", async () => {
    const { default: ticketsHandler } = await import("../api/v1/tickets.js");
    const res = createMockRes();
    await ticketsHandler({ method: "POST", headers: {}, body: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/tickets method not allowed -> 405 standard format", async () => {
    const { default: ticketsHandler } = await import("../api/v1/tickets.js");
    const res = createMockRes();
    await ticketsHandler({ method: "PUT", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/tickets create ok -> 201 (conditional)", async () => {
    const { default: ticketsHandler } = await import("../api/v1/tickets.js");
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;
    const res = createMockRes();
    await ticketsHandler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: { title: `Ticket ${Date.now()}`, detail: "Detalle", group_id: groupId },
      },
      res
    );
    assert.equal(res.statusCode, 201);
    assert.equal(Boolean(res.body?.data?.id), true);
  });

  test("/tickets get 200 (conditional)", async () => {
    const { default: ticketsHandler } = await import("../api/v1/tickets.js");
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;
    const res = createMockRes();
    await ticketsHandler(
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        query: { status: "open", groupId },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(Boolean(res.body?.data?.items), true);
  });

  test("/tickets patch ok -> 200 (conditional)", async () => {
    const { default: ticketsHandler } = await import("../api/v1/tickets.js");
    const token = process.env.TEST_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;
    const createRes = createMockRes();
    await ticketsHandler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: { title: `Ticket Patch ${Date.now()}`, detail: "Detalle", group_id: groupId },
      },
      createRes
    );
    const ticketId = createRes.body?.data?.id;
    if (!ticketId) return;
    const res = createMockRes();
    await ticketsHandler(
      {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "x-tenant-slug": tenantSlug },
        body: { id: ticketId, status: "resolved" },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.data?.id, ticketId);
  });

  test("/notebook without token -> 401 standard format", async () => {
    const { default: notebookHandler } = await import("../api/v1/notebook.js");
    const res = createMockRes();
    await notebookHandler({ method: "GET", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
  });

  test("/notebook method not allowed -> 405 standard format", async () => {
    const { default: notebookHandler } = await import("../api/v1/notebook.js");
    const res = createMockRes();
    await notebookHandler({ method: "PUT", headers: {}, body: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(Boolean(res.body?.error?.code), true);
    assert.equal(Boolean(res.body?.requestId), true);
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
