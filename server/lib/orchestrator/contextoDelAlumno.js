// CON QUIÉN HABLA EL TUTOR: nombre, curso y asignatura, sacados de la base.
//
// Hasta el 25/09/2026 el prompt decía "Nivel: deberes" y "Asignatura: no
// especificada" en TODAS las conversaciones: el nivel caía al modo (deberes,
// examen) porque nunca llegaba, y la asignatura se leía de un campo que el
// esquema de la petición descartaba. El tutor no sabía si hablaba con un
// niño de 3.º de Primaria o con uno de 4.º de ESO.
//
// Sale del servidor, no del navegador: sesión → tarea (asignatura) y alumno
// → grupo (etapa y curso). Si falla alguna lectura, el tutor sigue sin ese
// dato (es contexto, no permiso): se contesta igual, con menos precisión.
const ETAPAS = { primaria: "Primaria", eso: "ESO", bachillerato: "Bachillerato", fp: "FP" };

export function nivelDelGrupo(grupo) {
  if (!grupo) return null;
  const etapa = ETAPAS[String(grupo.stage || grupo.level || "").toLowerCase()] || null;
  if (!etapa) return null;
  return grupo.year ? `${grupo.year}.º de ${etapa}` : etapa;
}

export async function fetchContextoDelAlumno(admin, { sessionId, tenantId }) {
  try {
    const { data: sesion } = await admin.from("tutor_sessions")
      .select("student_id, task_id").eq("id", sessionId).eq("tenant_id", tenantId).maybeSingle();
    if (!sesion) return {};
    const [{ data: tarea }, { data: alumno }] = await Promise.all([
      sesion.task_id
        ? admin.from("tasks").select("subject_name").eq("id", sesion.task_id).eq("tenant_id", tenantId).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("students").select("first_name, display_name, group_id").eq("id", sesion.student_id).eq("tenant_id", tenantId).maybeSingle(),
    ]);
    const { data: grupo } = alumno?.group_id
      ? await admin.from("groups").select("stage, year, level").eq("id", alumno.group_id).eq("tenant_id", tenantId).maybeSingle()
      : { data: null };
    return {
      alumno_nombre: alumno?.first_name || alumno?.display_name || null,
      nivel_educativo: nivelDelGrupo(grupo),
      asignatura: tarea?.subject_name || null,
    };
  } catch {
    return {};
  }
}
