import assert from "node:assert/strict";

export async function run({ test }) {
  const {
    GroupCreateSchema,
    StudentsQuerySchema,
    StudentCreateSchema,
  } = await import("../api/v1/_lib/validators.js");

  const { default: meHandler } = await import("../api/v1/me.js");
  const { default: groupsHandler } = await import("../api/v1/groups.js");

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

  test("/groups without token -> 401 standard format", async () => {
    const res = createMockRes();
    await groupsHandler({ method: "GET", headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 401);
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
