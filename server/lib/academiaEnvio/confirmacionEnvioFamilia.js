// Política forward-only para el envío por familia: nunca se reenvía en
// silencio un documento ya enviado/pagado. Qué cuenta como "protegido"
// depende de `tipoEnvio` — un envío "solo_recibo" nunca debe bloquearse
// por informes ya enviados (no van en ese envío), y viceversa. Función
// pura (sin admin/supabase) para poder testearla sin mocks.
export function evaluarConfirmacionEnvioFamilia({ reciboEstado, informesEnviadosAt, tipoEnvio, confirmar }) {
  const reciboProtegido = tipoEnvio !== "solo_informe" && reciboEstado != null && reciboEstado !== "borrador";
  const informesProtegidos = tipoEnvio === "solo_recibo" ? 0 : informesEnviadosAt.filter(Boolean).length;
  const afectados = (reciboProtegido ? 1 : 0) + informesProtegidos;

  if (afectados && !confirmar) return { requiereConfirmacion: true, afectados };
  return { requiereConfirmacion: false, afectados };
}
