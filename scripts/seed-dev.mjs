import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const TEACHER_EMAIL = requireEnv("SEED_TEACHER_EMAIL");
const TEACHER_PASSWORD = requireEnv("SEED_TEACHER_PASSWORD");
const TENANT_SLUG = process.env.SEED_TENANT_SLUG || "lyceo";
const TENANT_NAME = process.env.SEED_TENANT_NAME || "Lyceo";
const GROUP_NAME = process.env.SEED_GROUP_NAME || "1º ESO A";
const GROUP_LEVEL = process.env.SEED_GROUP_LEVEL || "eso";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getOrCreateTenant() {
  const { data: existing, error } = await admin
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", TENANT_SLUG)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data, error: createError } = await admin
    .from("tenants")
    .insert({ slug: TENANT_SLUG, name: TENANT_NAME })
    .select("id, slug, name")
    .single();
  if (createError) throw createError;
  return data;
}

async function getOrCreateUser() {
  const { data, error: createError } = await admin.auth.admin.createUser({
    email: TEACHER_EMAIL,
    password: TEACHER_PASSWORD,
    email_confirm: true,
  });
  if (!createError && data?.user) return data.user;

  const msg = String(createError?.message || "");
  const looksLikeExists =
    msg.toLowerCase().includes("already registered") ||
    msg.toLowerCase().includes("already exists") ||
    msg.toLowerCase().includes("user already exists");

  if (!looksLikeExists) {
    throw createError || new Error("User creation failed");
  }

  const { data: listData, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  const found = (listData?.users || []).find(
    (u) => String(u.email || "").toLowerCase() === TEACHER_EMAIL.toLowerCase()
  );
  if (!found) {
    throw new Error("User exists but could not be found via listUsers");
  }
  return found;
}

async function ensureMembership(tenantId, userId) {
  const { data: existing, error } = await admin
    .from("tenant_memberships")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data, error: createError } = await admin
    .from("tenant_memberships")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      role: "teacher",
      status: "active",
    })
    .select("id")
    .single();
  if (createError) throw createError;
  return data;
}

async function ensureGroup(tenantId) {
  const { data: existing, error } = await admin
    .from("groups")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("name", GROUP_NAME)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data, error: createError } = await admin
    .from("groups")
    .insert({
      tenant_id: tenantId,
      name: GROUP_NAME,
      level: GROUP_LEVEL,
    })
    .select("id, name")
    .single();
  if (createError) throw createError;
  return data;
}

async function main() {
  const tenant = await getOrCreateTenant();
  const user = await getOrCreateUser();
  await ensureMembership(tenant.id, user.id);
  await ensureGroup(tenant.id);

  console.log("Seed OK");
  console.log(`tenant: ${tenant.slug} (${tenant.id})`);
  console.log(`teacher: ${user.email} (${user.id})`);
}

main().catch((err) => {
  console.error("Seed failed:", err?.message || err);
  process.exit(1);
});
