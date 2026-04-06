import { createClient } from "@supabase/supabase-js";

// ── Config desde variables de entorno ──────────────────────────────────────
// Copia las vars necesarias en tu .env local (ver .env para referencia)
const API           = process.env.E2E_API           || "https://tutordigital.onrender.com";
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL   = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASS    = process.env.E2E_ADMIN_PASS;
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL;
const STUDENT_PASS  = process.env.E2E_STUDENT_PASS;
const STUDENT_NAME  = process.env.E2E_STUDENT_NAME  || "Alumno Prueba";

if (!SUPABASE_URL || !SERVICE_KEY || !ADMIN_EMAIL || !ADMIN_PASS || !STUDENT_EMAIL || !STUDENT_PASS) {
  console.error("❌ Faltan variables de entorno. Revisa tu .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_*)");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function log(step, ok, detail) {
  const icon = ok ? "✅" : "❌";
  console.log(`\n${icon} ${step}`);
  if (detail) console.log("   ", JSON.stringify(detail, null, 2).replace(/\n/g, "\n    "));
}

async function api(method, path, body, token, tenantSlug) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (tenantSlug) headers["x-ttd-tenant"] = tenantSlug;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

// ── Cleanup previo: borrar alumno de prueba si existe ──────────────────────
async function cleanup() {
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existing = users?.users?.find(u => u.email === STUDENT_EMAIL);
  if (existing) {
    await sb.auth.admin.deleteUser(existing.id);
    console.log(`🧹 Usuario previo ${STUDENT_EMAIL} eliminado de Auth`);
  }
  await sb.from("student_invites").delete().eq("email", STUDENT_EMAIL);
  console.log(`🧹 Invites previos para ${STUDENT_EMAIL} eliminados`);
  await sb.from("students").delete().eq("display_name", STUDENT_NAME);
}

async function main() {
  console.log("══════════════════════════════════════════════");
  console.log("  E2E TEST — Flujo de registro de alumno");
  console.log("══════════════════════════════════════════════");

  await cleanup();

  // ── PASO 0: Login como admin ─────────────────────────────────────────────
  console.log("\n── Paso 0: Login admin ──────────────────────");
  const loginRes = await api("POST", "/api/v1/auth/login", {
    email: ADMIN_EMAIL, password: ADMIN_PASS
  });
  if (!loginRes.ok) { log("Login admin", false, loginRes.json); process.exit(1); }
  const token = loginRes.json?.data?.access_token;
  const memberships = loginRes.json?.data?.memberships || [];
  const adminM = memberships.find(m => m.role === "admin");
  const tenantSlug = adminM?.tenant_slug || adminM?.tenant?.slug || memberships[0]?.tenant_slug;
  log("Login admin OK", true, { token: token?.slice(0, 30) + "…", tenantSlug });

  // ── PASO 1: Crear grupo ──────────────────────────────────────────────────
  console.log("\n── Paso 1: POST /api/v1/admin/groups ────────");
  const createGroupRes = await api("POST", "/api/v1/admin/groups", {
    name: "1º ESO A", stage: "eso", year: 1, track: "A"
  }, token, tenantSlug);
  if (!createGroupRes.ok) { log("Crear grupo", false, createGroupRes.json); process.exit(1); }
  const groupId  = createGroupRes.json?.data?.group?.id;
  const joinCode = createGroupRes.json?.data?.join_code;
  log("Grupo creado", true, {
    group_id:      groupId,
    join_code:     joinCode,
    join_code_hint: createGroupRes.json?.data?.group?.join_code_hint,
    name:          createGroupRes.json?.data?.group?.name,
  });

  // ── PASO 2: Añadir email a lista blanca ──────────────────────────────────
  console.log("\n── Paso 2: POST /admin/groups/:id/students ──");
  const addStudentRes = await api(
    "POST", `/api/v1/admin/groups/${groupId}/students`,
    { email: STUDENT_EMAIL }, token, tenantSlug
  );
  if (!addStudentRes.ok) { log("Añadir email", false, addStudentRes.json); process.exit(1); }
  const inviteId = addStudentRes.json?.data?.invite?.id;
  log("Email autorizado", true, {
    invite_id: inviteId,
    email:     addStudentRes.json?.data?.invite?.email,
    status:    addStudentRes.json?.data?.invite?.status,
  });

  // ── PASO 3: Registro del alumno ──────────────────────────────────────────
  console.log("\n── Paso 3: POST /api/v1/student/register ────");
  const registerRes = await api("POST", "/api/v1/student/register", {
    group_code:   joinCode,
    email:        STUDENT_EMAIL,
    password:     STUDENT_PASS,
    display_name: STUDENT_NAME,
  });
  if (!registerRes.ok) { log("Registro alumno", false, registerRes.json); process.exit(1); }
  log("Registro OK", true, {
    status:     registerRes.json?.data?.status,
    tenant:     registerRes.json?.data?.tenant,
    group:      registerRes.json?.data?.group,
    route:      registerRes.json?.data?.route,
    session_ok: !!registerRes.json?.data?.session?.access_token,
  });

  // ── PASO 4: Verificación en Supabase ─────────────────────────────────────
  console.log("\n── Paso 4: Verificación en Supabase ─────────");

  const { data: grp } = await sb.from("groups").select("id,name,stage,year,track").eq("id", groupId).maybeSingle();
  log("groups: grupo existe", !!grp, grp);

  const { data: invite } = await sb.from("student_invites").select("id,email,status").eq("id", inviteId).maybeSingle();
  log("student_invites: status = 'used'", invite?.status === "used", invite);

  const { data: students } = await sb.from("students").select("id,display_name,group_id,status,approval_status").eq("group_id", groupId);
  const student = students?.find(s => s.display_name === STUDENT_NAME);
  log("students: alumno vinculado al grupo", !!student, student || students);

  const { data: authUsers } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const authUser = authUsers?.users?.find(u => u.email === STUDENT_EMAIL);
  const { data: memberships2 } = await sb.from("tenant_memberships").select("role,status").eq("user_id", authUser?.id || "");
  log("tenant_memberships: role=student active", memberships2?.[0]?.role === "student", memberships2);

  console.log("\n══════════════════════════════════════════════");
  console.log("  RESULTADO FINAL");
  console.log("══════════════════════════════════════════════");
  const allOk = !!grp && invite?.status === "used" && !!student && memberships2?.[0]?.role === "student";
  console.log(allOk ? "\n✅ Todos los pasos superados." : "\n⚠️  Algún paso falló — revisa arriba.");
}

main().catch(err => { console.error("ERROR:", err.message); process.exit(1); });
