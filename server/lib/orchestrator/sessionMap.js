// getSessionMap: lectura del mapa de pasos/ejercicios de una sesión.
//
// `tenantId` es obligatorio: tutor_session_maps no tiene tenant_id propio (se
// deriva vía session_id -> tutor_sessions.tenant_id) — sin validar esto,
// cualquier usuario autenticado que conociera/adivinara un sessionId de otro
// tenant podía leer sus pasos/ejercicios (bug de seguridad, corregido 2026-07-05).

import { createSupabaseAdmin } from "../supabase.js";

export async function getSessionMap(sessionId, tenantId) {
  const admin = createSupabaseAdmin();

  const { data: sessionRow, error: sessionErr } = await admin
    .from("tutor_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (sessionErr) return { ok: false, error: sessionErr.message };
  if (!sessionRow) return { ok: false, error: "forbidden" };

  const { data, error } = await admin
    .from("tutor_session_maps")
    .select("steps, current_step, exercises")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data)  return { ok: false, error: "not_found" };

  return {
    ok:          true,
    steps:       data.steps       || [],
    currentStep: data.current_step ?? 0,
    exercises:   data.exercises    || [],
  };
}
