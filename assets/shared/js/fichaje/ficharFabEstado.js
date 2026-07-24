// Umbral de aviso "deberías fichar salida" del FAB (ver ficharFab.js) —
// puramente visual/informativo, no dispara nada en el backend. Distinto
// a propósito del auto-cierre de seguridad a las 12h (funcionalidad de
// backend aparte, no implementada todavía): este umbral, más corto,
// busca que la mayoría de casos ni siquiera lleguen a necesitar ese
// auto-cierre. No fusionar ambos números.
export const HORAS_AVISO_SALIDA = 8;

// Traduce el estado real (dentro/haFichadoEntradaHoy/ultimoTimestamp,
// tal cual lo devuelve GET /academia/fichajes/mi-estado en ambos
// paneles) al estado visual del FAB. `pendiente` decide el modo visual
// (compacto vs. prominente) — la acción del clic (`siguienteTipo`) es
// siempre la misma independientemente de `pendiente`: fichar salida si
// está dentro, fichar entrada si no.
export function calcularEstadoFichajeFab(
  { dentro, haFichadoEntradaHoy, ultimoTimestamp },
  { ahoraMs = Date.now(), horasAvisoSalida = HORAS_AVISO_SALIDA } = {},
) {
  if (!haFichadoEntradaHoy) {
    return { dentro: false, pendiente: true, siguienteTipo: "entrada", etiquetaAccion: "Fichar entrada" };
  }
  if (dentro) {
    const horasDentro = ultimoTimestamp
      ? (ahoraMs - new Date(ultimoTimestamp).getTime()) / 3_600_000
      : 0;
    return { dentro: true, pendiente: horasDentro >= horasAvisoSalida, siguienteTipo: "salida", etiquetaAccion: "Fichar salida" };
  }
  // Ya fichó entrada y salida hoy (p.ej. una pausa) — en regla, pero se
  // puede volver a fichar entrada si retoma la jornada.
  return { dentro: false, pendiente: false, siguienteTipo: "entrada", etiquetaAccion: "Fichar entrada" };
}
