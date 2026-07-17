// Qué acciones puede pintar la lista unificada de Alumnos para una fila
// concreta, dado su estado (ver server/lib/studentLifecycle.js) y los ids
// que trae. El ESTADO lo decide el backend; esto solo decide, para ese
// estado+ids, cuáles de los endpoints de escritura YA EXISTENTES pueden
// llamarse — ninguno es nuevo:
//   - approve/reject  -> PATCH /admin/students/:studentId
//   - archive/restore -> DELETE|PUT /admin/students/:studentId/archive|restore
//   - resend          -> POST /admin/groups/:groupId/students/:studentId/resend
//                         (409 si la invitación no está "pending" — por eso
//                         una invitación "expired" no puede reenviarse aquí)
//   - revoke          -> DELETE /admin/groups/:groupId/students/:studentId
//   - delete          -> DELETE /admin/students/:studentId (borrado RGPD;
//                         requiere invite_id porque ese endpoint solo acepta
//                         el id de student_invites, nunca el de students)
export function computeRowActions(row, { hasCopyLink = false } = {}) {
  const state = row?.state;
  const isPendingInvite = state === "invitado" && row?.meta?.invite_status === "pending";
  return {
    approve: state === "pendiente_aprobacion",
    reject: state === "pendiente_aprobacion",
    archive: state === "activo" && Boolean(row?.student_id),
    restore: state === "archivado" && Boolean(row?.student_id),
    resend: isPendingInvite,
    copyLink: isPendingInvite && hasCopyLink,
    revoke: state === "invitado" && Boolean(row?.invite_id),
    delete: Boolean(row?.invite_id),
  };
}
