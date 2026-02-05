import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.js";

function getSupabaseUrl() {
  return requireEnv("SUPABASE_URL");
}

function getAnonKey() {
  return requireEnv("SUPABASE_ANON_KEY");
}

function getServiceRoleKey() {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function createSupabaseAdmin() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseUserClient(accessToken = "") {
  return createClient(getSupabaseUrl(), getAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : {},
  });
}

export function getBearerToken(req) {
  const header = String(req.headers?.authorization || "");
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}
