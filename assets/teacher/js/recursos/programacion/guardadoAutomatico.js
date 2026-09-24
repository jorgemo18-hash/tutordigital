// GUARDAR SOLO, MIENTRAS SE ESCRIBE: un segundo y medio después del último
// cambio, y al salir. Una programación se escribe durante horas; un botón
// "Guardar" que se olvida es una tarde perdida.
//
// `guardarFn()` devuelve una promesa; `onEstado(texto)` recibe "Guardando…",
// "Guardado" o el error. `reloj` se inyecta en los tests.
export const ESPERA_MS = 1500;

export function crearGuardadoAutomatico({ guardarFn, onEstado = () => {}, reloj = globalThis }) {
  let pendiente = null;
  let enCurso = null;
  let otraVez = false;

  async function guardarYa() {
    if (pendiente) { reloj.clearTimeout(pendiente); pendiente = null; }
    if (enCurso) { otraVez = true; return enCurso; }
    onEstado("Guardando…");
    enCurso = (async () => {
      try {
        await guardarFn();
        onEstado("Guardado");
      } catch (err) {
        onEstado(err?.message || "No se pudo guardar");
      } finally {
        enCurso = null;
      }
      if (otraVez) { otraVez = false; await guardarYa(); }
    })();
    return enCurso;
  }

  return {
    cambio() {
      onEstado("Cambios sin guardar");
      if (pendiente) reloj.clearTimeout(pendiente);
      pendiente = reloj.setTimeout(() => { pendiente = null; guardarYa(); }, ESPERA_MS);
    },
    guardarYa,
    get pendiente() { return Boolean(pendiente || enCurso); },
  };
}
