import { normalizeEmail } from "./adminStudentHelpers.js";

// Deriva el ciclo de vida unificado de "Alumnos del centro" a partir de dos
// fuentes que hoy se leen (y se muestran) por separado: student_invites y
// students. Fusionarlas aquí, en una función pura, es lo que evita que la
// misma persona aparezca dos veces (una por su invitación, otra por su
// aprobación) — ver server/routes/v1/admin.students.unified.routes.js.

export const STUDENT_STATES = Object.freeze({
  INVITADO: "invitado",
  PENDIENTE_APROBACION: "pendiente_aprobacion",
  ACTIVO: "activo",
  RECHAZADO: "rechazado",
  ARCHIVADO: "archivado",
});

const APPROVAL_STATUS_TO_STATE = {
  pending: STUDENT_STATES.PENDIENTE_APROBACION,
  approved: STUDENT_STATES.ACTIVO,
  rejected: STUDENT_STATES.RECHAZADO,
  archived: STUDENT_STATES.ARCHIVADO,
};

// approval_status es una columna de texto libre (no CHECK constraint), no un
// enum de verdad — un valor desconocido o corrupto se trata como pendiente en
// vez de descartar la fila, para que un alumno nunca desaparezca de la lista
// por un dato inesperado.
function deriveApprovalState(approvalStatus) {
  return APPROVAL_STATUS_TO_STATE[approvalStatus] || STUDENT_STATES.PENDIENTE_APROBACION;
}

function fullName({ display_name, first_name, last_name }) {
  const combined = [first_name, last_name].filter(Boolean).join(" ").trim();
  return display_name || combined || null;
}

// Compara por fecha de creación (string ISO) sin usar Date.now()/similares —
// solo compara los timestamps ya presentes en las filas, así que es
// determinista y testeable con fechas fijas.
function isNewer(a, b) {
  return new Date(a).getTime() > new Date(b).getTime();
}

/**
 * @param {Array} invites   student_invites: {id, email, status, group_id, first_name, last_name, display_name, created_at, expires_at}
 * @param {Array} students  students + email ya resuelto por user_id: {id, email, user_id, group_id, display_name, first_name, last_name, approval_status, created_at, approved_at, rejected_at, rejected_reason}
 * @param {Map}   groupNamesById  group_id -> name
 * @returns {Array} filas unificadas, más recientes primero
 */
export function deriveUnifiedStudentList({ invites = [], students = [], groupNamesById = new Map() } = {}) {
  // Invitaciones ya canjeadas (status="used"): quedan indexadas por email
  // únicamente para poder resolver, más abajo, el invite_id que necesita la
  // acción "Eliminar" (RGPD) — que hoy solo existe como
  // DELETE /admin/students/:studentId con :studentId = student_invites.id.
  // No generan fila propia: la fila de `students` ya representa a esa
  // persona, y son exactamente el origen del bug de duplicados que esta
  // función existe para resolver.
  const usedInvitesByEmail = new Map();
  for (const inv of invites) {
    if (inv.status !== "used") continue;
    const email = normalizeEmail(inv.email);
    if (!email) continue;
    const prev = usedInvitesByEmail.get(email);
    if (!prev || isNewer(inv.created_at, prev.created_at)) {
      usedInvitesByEmail.set(email, inv);
    }
  }

  const studentEmails = new Set(students.map((s) => normalizeEmail(s.email)).filter(Boolean));

  const rows = [];

  // 1) Personas registradas — la fila `students` manda siempre sobre
  //    cualquier invitación para el mismo email, incluida una invitación
  //    revocada, o incluso una invitación "pending"/"expired" NUEVA creada
  //    por error después del registro (colisión real: un admin puede volver
  //    a invitar a alguien que ya tiene cuenta sin darse cuenta). Una vez
  //    existe cuenta, el estado real vive en `students.approval_status`, no
  //    en el estado de la invitación que la originó. Para quitarle acceso a
  //    alguien ya registrado la acción correcta es Archivar, no Revocar —
  //    ver el filtro por `studentEmails` en el paso 2.
  for (const s of students) {
    const email = normalizeEmail(s.email);
    const matchedInvite = email ? usedInvitesByEmail.get(email) : null;
    rows.push({
      key: `student:${s.id}`,
      student_id: s.id,
      invite_id: matchedInvite ? matchedInvite.id : null,
      email: s.email || null,
      name: fullName(s),
      group_id: s.group_id || null,
      group_name: s.group_id ? groupNamesById.get(s.group_id) || null : null,
      state: deriveApprovalState(s.approval_status),
      created_at: s.created_at,
      meta: {
        approved_at: s.approved_at || null,
        rejected_at: s.rejected_at || null,
        rejected_reason: s.rejected_reason || null,
      },
    });
  }

  // 2) Invitaciones sin canjear — únicos casos donde la invitación es la
  //    fuente de verdad, porque por construcción (redeem_student_invite y
  //    student.register.routes.js crean la fila `students` y marcan la
  //    invitación "used" en la misma operación) no existe todavía ninguna
  //    fila `students` para este email.
  //    - "revoked" se excluye a propósito: mismo criterio que ya aplica hoy
  //      groupInvites.js (renderStudentsList filtra status !== "revoked") —
  //      es un registro muerto, no una invitación accionable.
  //    - "expired" SÍ se muestra (bajo el mismo estado "invitado"): sigue
  //      siendo alguien a quien se puede reenviar una invitación nueva.
  //    - se excluye igualmente si el email ya tiene fila `students` (ver
  //      comentario del paso 1) — evita el duplicado incluso en la
  //      colisión rara "invitación pending/expired + ya registrado".
  for (const inv of invites) {
    if (inv.status !== "pending" && inv.status !== "expired") continue;
    if (studentEmails.has(normalizeEmail(inv.email))) continue;
    rows.push({
      key: `invite:${inv.id}`,
      student_id: null,
      invite_id: inv.id,
      email: inv.email || null,
      name: fullName(inv) || inv.email || null,
      group_id: inv.group_id || null,
      group_name: inv.group_id ? groupNamesById.get(inv.group_id) || null : null,
      state: STUDENT_STATES.INVITADO,
      created_at: inv.created_at,
      meta: { invite_status: inv.status, expires_at: inv.expires_at || null },
    });
  }

  // 3) Invitaciones "used" sin ninguna fila `students` correspondiente — una
  //    anomalía que no debería darse nunca en el flujo normal (la RPC
  //    redeem_student_invite y student.register.routes.js crean ambas filas
  //    en la misma operación), pero si los datos están así de todos modos se
  //    muestra en vez de desaparecer en silencio: se asume "activo" porque
  //    ambos flujos de registro fijan approval_status="approved" por
  //    defecto, sin poder ofrecer Archivar/Aprobar (no hay student_id) — el
  //    llamador debe tratar student_id=null en estado "activo" como señal
  //    para deshabilitar esas acciones.
  for (const inv of usedInvitesByEmail.values()) {
    if (studentEmails.has(normalizeEmail(inv.email))) continue;
    rows.push({
      key: `invite:${inv.id}`,
      student_id: null,
      invite_id: inv.id,
      email: inv.email || null,
      name: fullName(inv) || inv.email || null,
      group_id: inv.group_id || null,
      group_name: inv.group_id ? groupNamesById.get(inv.group_id) || null : null,
      state: STUDENT_STATES.ACTIVO,
      created_at: inv.created_at,
      meta: { orphan_used_invite: true },
    });
  }

  return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
