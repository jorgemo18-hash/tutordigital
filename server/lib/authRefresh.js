import { createSupabaseUserClient } from "./supabase.js";

// createClientFn explícito (no se llama a createSupabaseUserClient()
// directo en el cuerpo) para poder testear sin mockear el import de
// supabase-js — mismo patrón que manejarSubidaNormas.js.
export async function refreshUserSession(refreshToken, { createClientFn = createSupabaseUserClient } = {}) {
  const client = createClientFn();
  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session) {
    return { ok: false, motivo: error?.message || "No se pudo refrescar la sesión." };
  }
  return {
    ok: true,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type,
    },
  };
}
