// Política forward-only para regenerar informes: nunca se sobrescribe un
// informe ya enviado en silencio — el llamador debe confirmar
// explícitamente. Función pura (sin admin/supabase) para poder testearla
// sin mocks. `informesEnviadosPorAlumno` es alumno_id -> enviado_at|null.
export function evaluarConfirmacionInformes(informesEnviadosPorAlumno, alumnoIds, confirmar) {
  const protegidos = alumnoIds.filter((id) => informesEnviadosPorAlumno[id]);
  if (protegidos.length && !confirmar) {
    return { requiereConfirmacion: true, afectados: protegidos.length };
  }
  return { requiereConfirmacion: false, afectados: protegidos.length };
}
