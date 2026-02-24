import assert from "node:assert/strict";
import crypto from "node:crypto";

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

  function hashInviteCode(code = "") {
    const pepper = process.env.INVITE_CODE_PEPPER || process.env.JOIN_CODE_PEPPER || "";
    return crypto.createHash("sha256").update(`${pepper}${String(code).trim()}`).digest("hex");
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
    assert.equal(res.statusCode, 201);
    assert.equal(Boolean(b?.data?.invite?.code), true);

    const hasServiceEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!hasServiceEnv) return;

    const { createSupabaseAdmin } = await import("../server/lib/supabase.js");
    const admin = createSupabaseAdmin();
    const expectedCode = String(b?.data?.invite?.code || "");
    const expectedHash = hashInviteCode(expectedCode);

    const { data: row, error } = await admin
      .from("teacher_invites")
      .select("id, email, code_hash, code, status, tenant_slug")
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
    if (row?.code_hash) {
      assert.equal(row.code_hash, expectedHash);
    } else {
      assert.equal(row?.code, expectedCode);
    }
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
