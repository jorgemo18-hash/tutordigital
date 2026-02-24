import assert from "node:assert/strict";

export async function run({ test }) {
  const { createApp } = await import("../server/app.js");
  const { __adminTeachersInviteTestables } = await import("../server/routes/v1/admin.teachers.routes.js");

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

  test("admin teachers invite without auth -> 401", async () => {
    const res = await inject({
      method: "POST",
      url: "/api/v1/admin/teachers/invite",
      headers: { "x-ttd-tenant": "demo" },
      payload: {
        email: "teacher@example.com",
        display_name: "Teacher",
        subjects: ["Matemáticas"],
        group_ids: [],
      },
    });
    const b = body(res);
    assert.equal(res.statusCode, 401);
    assert.equal(Boolean(b?.error?.code), true);
    assert.equal(Boolean(b?.requestId), true);
  });

  test("admin teachers invite as admin -> 201 (conditional)", async () => {
    const token = process.env.TEST_ADMIN_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_ADMIN_INVITE_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;

    const inviteEmail = `teacher+${Date.now()}@example.com`;
    const res = await inject({
      method: "POST",
      url: "/api/v1/admin/teachers/invite",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
        origin: "http://localhost:5173",
      },
      payload: {
        email: inviteEmail,
        display_name: "Teacher Invite Test",
        subjects: ["Matemáticas", "Física"],
        group_ids: [groupId],
        tutor_group_id: groupId,
      },
    });

    const b = body(res);
    const invite = b?.data?.invite || b?.invite || {};
    assert.equal(res.statusCode, 201);
    assert.equal(Boolean(invite?.code), true);
    assert.equal(String(invite?.source || ""), "teacher_invites");

    const hasServiceEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!hasServiceEnv) return;
    if (String(invite?.source || "") !== "teacher_invites") return;

    const { createSupabaseAdmin } = await import("../server/lib/supabase.js");
    const admin = createSupabaseAdmin();
    const expectedCode = String(invite?.code || "");
    const { data: row, error } = await admin
      .from("teacher_invites")
      .select("id, email, code, status, tenant_slug")
      .eq("tenant_slug", tenantSlug)
      .eq("email", inviteEmail)
      .order("created_at", { ascending: false })
      .maybeSingle();

    assert.equal(Boolean(error), false);
    assert.equal(Boolean(row?.id), true);
    assert.equal(row?.tenant_slug, tenantSlug);
    assert.equal(row?.status, "pending");
    assert.equal(row?.email?.startsWith("teacher+"), true);
    assert.equal(row?.email?.endsWith("@example.com"), true);
    assert.equal(row?.code, expectedCode);
  });

  test("admin teachers invite on simulated PGRST205 -> 503 schema_cache_stale (conditional)", async () => {
    const token = process.env.TEST_ADMIN_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    const groupId = process.env.TEST_ADMIN_INVITE_GROUP_ID || "";
    if (!token || !tenantSlug || !groupId) return;

    const prev = process.env.TEST_FORCE_TEACHER_INVITES_PGRST205;
    process.env.TEST_FORCE_TEACHER_INVITES_PGRST205 = "1";

    try {
      const res = await inject({
        method: "POST",
        url: "/api/v1/admin/teachers/invite",
        headers: {
          authorization: `Bearer ${token}`,
          "x-ttd-tenant": tenantSlug,
          origin: "http://localhost:5173",
        },
        payload: {
          email: `teacher+fallback-${Date.now()}@example.com`,
          display_name: "Teacher Invite Fallback Test",
          subjects: ["Biología"],
          group_ids: [groupId],
          tutor_group_id: groupId,
        },
      });

      const b = body(res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.headers["x-ttd-version"], "v7.1.7-invite-no-invites");
      assert.equal(b?.error?.code, "schema_cache_stale");
      assert.equal(b?.error?.apiVersion, "v7.1.7-invite-no-invites");
    } finally {
      if (prev == null) delete process.env.TEST_FORCE_TEACHER_INVITES_PGRST205;
      else process.env.TEST_FORCE_TEACHER_INVITES_PGRST205 = prev;
    }
  });

  test("admin teachers invite runtime path does not call from('invites')", async () => {
    const calls = [];
    const supabaseMock = {
      from(table) {
        calls.push(table);
        if (table === "invites") throw new Error("BUG: invites path executed");
        if (table !== "teacher_invites") throw new Error(`unexpected table: ${table}`);
        return {
          async insert(payload) {
            assert.equal(payload?.email, "teacher@example.com");
            assert.equal(Boolean(payload?.code), true);
            return { error: null };
          },
        };
      },
    };

    const result = await __adminTeachersInviteTestables.insertInviteWithFallback(supabaseMock, {
      tenantId: "00000000-0000-0000-0000-000000000001",
      tenantSlug: "demo",
      email: "teacher@example.com",
      code: "ABCD-EFGH",
      userId: "00000000-0000-0000-0000-000000000002",
      displayName: "Teacher",
      subjects: ["Matemáticas"],
      groupIds: ["00000000-0000-0000-0000-000000000003"],
      tutorGroupId: "00000000-0000-0000-0000-000000000003",
    });

    assert.equal(result?.source, "teacher_invites");
    assert.equal(calls.includes("invites"), false);
  });

  test("admin teachers invite as non-admin -> 403 (conditional)", async () => {
    const token = process.env.TEST_TEACHER_AUTH_ACCESS_TOKEN || "";
    const tenantSlug = process.env.TEST_TENANT_SLUG || "";
    if (!token || !tenantSlug) return;

    const res = await inject({
      method: "POST",
      url: "/api/v1/admin/teachers/invite",
      headers: {
        authorization: `Bearer ${token}`,
        "x-ttd-tenant": tenantSlug,
        origin: "http://localhost:5173",
      },
      payload: {
        email: `teacher+${Date.now()}@example.com`,
        display_name: "Teacher Invite Test",
        subjects: ["Historia"],
        group_ids: [],
      },
    });

    const b = body(res);
    assert.equal(res.statusCode, 403);
    assert.equal(Boolean(b?.error?.code), true);
  });
}
