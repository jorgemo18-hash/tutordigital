import { fetchNombreDesdeTeacherProfiles } from "./profileDisplayName.js";

// Garantiza que exista una fila en public.profiles para un userId dado —
// varias FKs de la app (academia_fichajes.worker_profile_id/corregido_por,
// entre otras) apuntan a profiles(id), pero el flujo de invitación de
// profesor (teacher.invites.routes.js, teacherUtils.js#autoRedeemInvites)
// nunca creó esa fila: solo hace upsert de teacher_profiles +
// tenant_memberships. A diferencia del alta de alumno (public.onboarding.
// routes.js) o de admin (superadmin.tenant.create.routes.js), que sí la
// crean, un profesor invitado quedaba con auth.users pero sin profiles —
// causa raíz confirmada del 500 en POST /academia/fichajes/fichar para
// role='teacher' (insert o update en academia_fichajes viola la FK
// worker_profile_id -> profiles(id) porque esa fila nunca existió).
//
// Se llama en dos sitios: en el propio flujo de redeem (para que un
// profesor NUEVO nunca llegue a tener este problema) y, como red de
// seguridad, dentro de registrarFichaje/registrarCorreccion (para
// autocurar cuentas ya invitadas antes de este fix, sin depender de un
// backfill manual en producción).
//
// Causa raíz de un bug real de producción (confirmada con datos: fila de
// teacher_profiles con nombre creada 2 horas ANTES que la fila de
// profiles): cuando esta función crea la fila al vuelo desde la red de
// seguridad (fichar.js/correccion.js), quien llama no siempre tiene ya un
// `displayName` a mano (a diferencia del flujo de redeem, que pasa
// invite.display_name) — sin fallback, esa fila quedaba con display_name
// NULL para siempre, aunque el profesor SÍ tuviera nombre en
// teacher_profiles desde antes. Por eso, si no llega `displayName`
// explícito, se intenta resolverlo ahí antes de rendirse. Si tampoco hay
// nada en teacher_profiles (p.ej. un admin sin invitación de por medio, o
// un `tenantSlug` no disponible en este punto), se guarda NULL a
// propósito: no inventamos un nombre de donde no lo hay.
export async function ensureProfileExists(admin, userId, { displayName = null, tenantSlug = null } = {}) {
  const { data } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (data) return { created: false };

  const nombre = displayName || (tenantSlug ? await fetchNombreDesdeTeacherProfiles(admin, tenantSlug, userId) : null);

  const { error } = await admin
    .from("profiles")
    .upsert({ id: userId, display_name: nombre || null }, { onConflict: "id" });
  return { created: !error, error: error || null };
}
