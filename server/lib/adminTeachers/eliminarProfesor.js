// Quitar a un profesor de la plantilla.
//
// Hay DOS acciones distintas y confundirlas se paga caro:
//
//   - DAR DE BAJA (`is_active = false`, PATCH de siempre): la persona deja
//     de dar clase pero su rastro se queda. Es lo que toca cuando se va del
//     centro: sus clases del diario, sus fichajes y sus informes siguen
//     diciendo quién los hizo, que es lo que exige tanto el sentido común
//     como el registro de jornada.
//   - ELIMINAR: la ficha desaparece. Solo tiene sentido para un error —
//     una ficha creada por equivocación o duplicada— y SOLO si no ha dejado
//     rastro. Borrar a alguien que ya ha dado clase dejaría el diario y el
//     horario apuntando al vacío (`on delete set null`), en silencio.
//
// Por eso esto no es un DELETE a secas: primero se mira si hay algo colgando
// y, si lo hay, se dice EXACTAMENTE qué y se propone la baja.

// Cada comprobación es una consulta con `head: true` — solo cuenta, no trae
// filas: no hace falta el contenido para saber si hay rastro.
async function contar(admin, tabla, filtros) {
  let query = admin.from(tabla).select("id", { count: "exact", head: true });
  for (const [col, val] of Object.entries(filtros)) query = query.eq(col, val);
  const { count, error } = await query;
  if (error) return { error };
  return { count: count || 0 };
}

// Devuelve la lista de motivos (en castellano, para enseñárselos tal cual)
// por los que este profesor NO se puede eliminar. Vacía = se puede.
export async function motivosQueImpidenEliminar(admin, { profile, tenantId }) {
  const motivos = [];

  const comprobaciones = [
    { tabla: "academia_profesor_alumnos", filtros: { tenant_id: tenantId, profesor_id: profile.id },
      texto: (n) => `tiene ${n} ${n === 1 ? "alumno asignado" : "alumnos asignados"}` },
    { tabla: "academia_sesiones", filtros: { tenant_id: tenantId, profesor_id: profile.id },
      texto: (n) => `tiene ${n} ${n === 1 ? "clase" : "clases"} en el diario` },
    { tabla: "academia_horario", filtros: { tenant_id: tenantId, profesor_id: profile.id },
      texto: (n) => `imparte ${n} ${n === 1 ? "franja" : "franjas"} del horario` },
    { tabla: "academia_sustituciones", filtros: { tenant_id: tenantId, profesor_sustituto_id: profile.id },
      texto: (n) => `ha hecho ${n} ${n === 1 ? "sustitución" : "sustituciones"}` },
    { tabla: "academia_sustituciones", filtros: { tenant_id: tenantId, profesor_sustituido_id: profile.id },
      texto: (n) => `${n === 1 ? "tiene una sustitución" : `tiene ${n} sustituciones`} a su nombre` },
  ];

  for (const { tabla, filtros, texto } of comprobaciones) {
    const { count, error } = await contar(admin, tabla, filtros);
    if (error) return { error };
    if (count) motivos.push(texto(count));
  }

  // Los fichajes no cuelgan de teacher_profiles sino de la CUENTA
  // (academia_fichajes.worker_profile_id -> profiles.id), así que se
  // comprueban por user_id. Un profesor que ha fichado tiene registro de
  // jornada: eso no se borra desde un panel.
  if (profile.user_id) {
    const { count, error } = await contar(admin, "academia_fichajes", {
      tenant_id: tenantId, worker_profile_id: profile.user_id,
    });
    if (error) return { error };
    if (count) motivos.push(`tiene ${count} ${count === 1 ? "fichaje registrado" : "fichajes registrados"}`);
  }

  return { motivos };
}

// Borra la ficha y, si esa persona llegó a entrar con su cuenta, la saca
// también del centro. Solo se le retira la membresía si es de PROFESOR:
// si resulta ser admin (el caso del administrador que da clase), quitarla
// le dejaría fuera de su propia academia.
export async function eliminarProfesor(admin, { profile, tenantId }) {
  if (profile.user_id) {
    const { error: memErr } = await admin
      .from("tenant_memberships")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", profile.user_id)
      .eq("role", "teacher");
    if (memErr) return { error: memErr };
  }

  const { error } = await admin.from("teacher_profiles").delete().eq("id", profile.id);
  if (error) return { error };
  return { ok: true };
}
