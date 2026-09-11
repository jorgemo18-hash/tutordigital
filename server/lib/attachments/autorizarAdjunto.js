import { verificarAlumnoVisible, verificarGrupoVisible } from "../instituto/alumnosVisibles.js";
import { getStudentForUser } from "../tasksHelpers.js";
import { taskBelongsToStudent } from "../taskOwnership.js";

// ¿PUEDE ESTE USUARIO ABRIR (o BORRAR) ESTE ADJUNTO?
//
// EL AGUJERO QUE CIERRA (verificado el 11/09/2026 leyendo el código, no
// deducido). `GET /api/v1/attachments/:id/signed-url` comprobaba DOS cosas:
// que tuvieras un rol del centro y que el adjunto fuera del mismo tenant.
// Nada más. Con el id de un adjunto, cualquier alumno del centro se
// descargaba cualquier archivo del centro — la foto del cuaderno de un
// compañero incluida. El `DELETE` igual: profesor o admin, sin mirar de qué
// grupo, así que un profesor podía borrar adjuntos de un grupo que no es
// suyo.
//
// Lo único que lo tapaba era que los ids son UUID aleatorios: seguridad por
// que nadie adivine el número. Cualquier sitio que filtre un id —un log, un
// enlace compartido, un listado con un fallo— lo convertía en acceso
// completo. Y la URL firmada dura SIETE DÍAS: una vez conseguida, revocar el
// acceso del usuario no la cierra.
//
// SE DERIVA DEL MISMO PUNTO DE DECISIÓN QUE EL RESTO DEL LADO TUTOR
// (instituto/alumnosVisibles.js), que es el que usan tutor-sessions,
// notebook y el detalle de sesión. La regla de quién ve a quién no se vuelve
// a escribir aquí: si algún día cambia, cambia en un sitio.
//
// LA REGLA, por rol:
//
//   admin   -> le basta el tenant (es su centro).
//   teacher -> el GRUPO de la tarea tiene que ser suyo; si la tarea no tiene
//              grupo (sesión libre, tarea de sistema del alumno), tiene que
//              ser suyo el ALUMNO.
//   student -> la tarea tiene que ser suya Y el adjunto lo tiene que haber
//              subido el profesor de la tarea o él mismo.
//
// POR QUÉ AL ALUMNO NO LE BASTA "LA TAREA ES MÍA", que es el detalle que de
// verdad cierra el agujero: en una tarea de GRUPO, dos alumnos suben cada
// uno la foto de su cuaderno. Los dos pasan "esta tarea es mía". Sin la
// segunda condición, cada uno se descarga el cuaderno del otro — que es
// exactamente el caso que había que cerrar. Es la misma regla que ya aplica
// `attachAttachments` al LISTADO (solo enseña lo que subió el profesor de la
// tarea); aquí se le añade "o lo subió él mismo", porque su propio archivo
// sí puede volver a abrirlo.
//
// LÍMITE CONOCIDO, y es el mismo que tiene hoy todo el lado tutor: la
// visibilidad del profesor se resuelve por `teacher_groups` →
// `students.group_id`, que es el modelo del INSTITUTO. En una academia los
// alumnos viven en `academia_alumnos` y pueden no tener `group_id`, así que
// un profesor de academia puede quedar fuera de un adjunto de su propio
// alumno. No se arregla aquí inventando una segunda regla: se arregla en
// alumnosVisibles.js, que es el punto de decisión que ya comparten
// tutor-sessions, notebook y el detalle de sesión. Hoy no afecta a nadie
// —Lyceo tiene `acceso_tutor_activo` en false y el admin da las clases—,
// pero cuando entren los alumnos hay que mirarlo.
//
// UN ERROR DE BASE DE DATOS NUNCA ES UN "SÍ". Se devuelve
// `visibilidad_fetch_failed` y la ruta responde 500 — mismo criterio que
// alumnosVisibles.js, escrito ahí tras el fallo de GET /api/v1/tasks: un
// helper que devolvía "sin filtro" cuando la consulta fallaba abría el
// centro entero con un error transitorio.

const DENEGADO = { ok: false, code: "adjunto_no_visible" };

// `adjunto`: la fila de attachments ya leída y comprobada en el tenant
// (id, owner_type, owner_id, uploader_id).
export async function autorizarAdjunto(admin, {
  role,
  tenantId,
  tenantSlug,
  userId,
  email = "",
  adjunto,
}) {
  if (!adjunto) return DENEGADO;

  // Hoy solo se escribe owner_type "task" (ver POST /attachments). Un tipo
  // distinto significa que alguien añadió otro dueño y no pasó por aquí:
  // se deniega en vez de dejarlo pasar sin comprobar nada. Cerrado por
  // defecto — un owner_type nuevo tiene que venir con su regla.
  if (adjunto.owner_type !== "task") return { ok: false, code: "owner_type_sin_regla" };

  const { data: tarea, error } = await admin
    .from("tasks")
    .select("id, group_id, student_id, teacher_id")
    .eq("id", adjunto.owner_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) return { ok: false, code: "visibilidad_fetch_failed", error };

  // TAREA BORRADA. En producción (11/09/2026) hay 34 adjuntos de Lyceo así:
  // fotos de cuaderno de las sesiones de mayo-junio cuyas tareas ya no
  // existen — borrar una tarea no se lleva sus adjuntos, ni de la tabla ni
  // de Storage (11,8 MB). Sin tarea no hay grupo ni alumno contra los que
  // comprobar nada, así que NADIE puede quedar autorizado por esa vía.
  //
  // Se deja pasar solo al admin, y es una decisión, no un descuido: son
  // archivos de su propio centro y es el único que puede revisarlos o
  // limpiarlos. Al profesor y al alumno se les deniega.
  if (!tarea) return role === "admin" ? { ok: true } : DENEGADO;

  if (role === "admin") return { ok: true };

  if (role === "teacher") {
    if (tarea.group_id) {
      return traducir(await verificarGrupoVisible(admin, {
        role, tenantSlug, userId, email, grupoId: tarea.group_id,
      }));
    }
    if (tarea.student_id) {
      return traducir(await verificarAlumnoVisible(admin, {
        role, tenantId, tenantSlug, userId, email, alumnoId: tarea.student_id,
      }));
    }
    // Sin grupo y sin alumno la tarea no es atribuible a nadie: no hay
    // manera de decir que sea de este profesor.
    return DENEGADO;
  }

  if (role === "student") {
    const alumno = await getStudentForUser(admin, tenantId, userId);
    if (!alumno) return DENEGADO;
    const suya = await taskBelongsToStudent(admin, { tenantId, taskId: tarea.id, student: alumno });
    if (!suya) return DENEGADO;
    // La segunda condición, la que cierra el caso del compañero.
    const loSubioSuProfesor = Boolean(tarea.teacher_id) && adjunto.uploader_id === tarea.teacher_id;
    const loSubioElMismo = Boolean(adjunto.uploader_id) && adjunto.uploader_id === userId;
    return loSubioSuProfesor || loSubioElMismo ? { ok: true } : DENEGADO;
  }

  // Un rol que no es ninguno de los tres no tiene regla escrita: se deniega.
  return DENEGADO;
}

// El veredicto de alumnosVisibles.js con el vocabulario de los adjuntos. Se
// conserva `visibilidad_fetch_failed` tal cual porque la ruta lo distingue:
// ese es un 500, no un "no es tuyo".
function traducir(veredicto) {
  if (veredicto.ok) return { ok: true };
  if (veredicto.code === "visibilidad_fetch_failed") return veredicto;
  return DENEGADO;
}
