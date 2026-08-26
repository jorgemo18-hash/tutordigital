// Ficha de profesor para el administrador del centro.
//
// La identidad DOCENTE de una persona no vive en su rol: vive en
// `teacher_profiles`, cuya unicidad es (tenant_slug, email) y que no
// comprueba el rol de nadie — findProfesorId busca por user_id y punto.
// Por eso una cuenta de admin SÍ puede tener ficha de profesor y alumnos
// asignados, aunque `tenant_memberships` solo le permita un rol por centro.
//
// Para qué hace falta: en una academia con varios profesores, el admin que
// además da clase necesita ver SUS alumnos cuando enseña, no los del centro
// entero. Ese alcance sale de las asignaciones
// (`academia_profesor_alumnos`), que cuelgan de la ficha de profesor. Sin
// ficha no hay a quién asignar nada.
//
// Idempotente: si ya existe una ficha con ese email en el centro, se
// devuelve tal cual — y si estaba huérfana (creada por email antes de que
// esa persona tuviera cuenta) se le enlaza el user_id, que es justo lo que
// findProfesorId necesita para reconocerla.

export async function asegurarFichaProfesorDeAdmin(admin, { tenantId, tenantSlug, userId, email, displayName }) {
  const correo = String(email || "").trim().toLowerCase();
  if (!correo) return { ok: false, code: "sin_email" };

  const { data: existente, error: buscarErr } = await admin
    .from("teacher_profiles")
    .select("id, user_id, is_active")
    .eq("tenant_slug", tenantSlug)
    .eq("email", correo)
    .maybeSingle();
  if (buscarErr) return { ok: false, code: "buscar_failed", error: buscarErr };

  if (existente) {
    // Solo se completa lo que falta. No se reactiva una ficha desactivada a
    // propósito ni se pisa un user_id ya enlazado: dar de baja a alguien es
    // una decisión del admin que este atajo no debe deshacer.
    const parche = {};
    if (!existente.user_id) parche.user_id = userId;
    if (!Object.keys(parche).length) return { ok: true, profesorId: existente.id, creada: false };

    const { error: actualizarErr } = await admin
      .from("teacher_profiles")
      .update(parche)
      .eq("id", existente.id);
    if (actualizarErr) return { ok: false, code: "enlazar_failed", error: actualizarErr };
    return { ok: true, profesorId: existente.id, creada: false, enlazada: true };
  }

  const { data: creada, error: crearErr } = await admin
    .from("teacher_profiles")
    .insert({
      tenant_id: tenantId,
      tenant_slug: tenantSlug,
      email: correo,
      user_id: userId,
      // display_name es NOT NULL en la tabla: el email es el último recurso
      // antes de romper el alta por un nombre que el admin puede editar
      // después desde Profesores.
      display_name: String(displayName || "").trim() || correo,
      is_active: true,
      created_by: userId,
    })
    .select("id")
    .single();
  if (crearErr) return { ok: false, code: "crear_failed", error: crearErr };
  return { ok: true, profesorId: creada.id, creada: true };
}
