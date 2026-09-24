// Cuántos recibos del mes hay en cada estado, para que el diálogo de
// "Regenerar" diga con números qué va a tocar cada opción (24/09/2026).
// `familias`: la lista de "Envío a familias" (solo las que tienen alumnos
// activos, que son las que pueden tener recibo nuevo).
export function resumenDeRecibos(familias) {
  const resumen = { sinRecibo: 0, borradores: 0, enviados: 0, pagados: 0 };
  for (const f of familias || []) {
    const estado = f.recibo?.estado;
    if (!f.recibo) resumen.sinRecibo += 1;
    else if (estado === "pagado") resumen.pagados += 1;
    else if (estado === "enviado") resumen.enviados += 1;
    else resumen.borradores += 1;
  }
  return resumen;
}
