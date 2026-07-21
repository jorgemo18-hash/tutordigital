// Política forward-only para regenerar recibos: nunca se sobrescribe un
// recibo ya enviado/pagado en silencio — el llamador debe confirmar
// explícitamente. Función pura (sin admin/supabase) para poder testearla
// sin mocks.
export function evaluarConfirmacionRecibos(recibosDelPeriodo, confirmar) {
  const protegidos = recibosDelPeriodo.filter((r) => r.estado !== "borrador");
  if (protegidos.length && !confirmar) {
    return { requiereConfirmacion: true, afectados: protegidos.length };
  }
  return { requiereConfirmacion: false, afectados: protegidos.length };
}
