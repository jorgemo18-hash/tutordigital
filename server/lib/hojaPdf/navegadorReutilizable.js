// UN SOLO CHROMIUM POR INSTANCIA DE LA FUNCIÓN, reutilizado entre PDFs.
//
// Arrancar Chromium es lo más lento de hacer un PDF (segundos). Vercel
// reutiliza la misma instancia de la función para peticiones seguidas
// mientras está "caliente", así que el navegador se deja abierto y el
// siguiente PDF se ahorra el arranque. Jorge, 23/9: *"¿no puede ser más
// rápido?"*.
//
// Si el navegador se ha caído (o la instancia se congeló y lo perdió), se
// arranca otro. Si una impresión falla, se descarta por si quedó en mal
// estado. `lanzar` se inyecta (ver lanzaNavegador.js).
export function crearNavegadorReutilizable({ lanzar }) {
  let enCurso = null;

  async function obtener() {
    if (enCurso) {
      const actual = await enCurso.catch(() => null);
      if (actual?.connected) return actual;
      enCurso = null;
    }
    enCurso = lanzar();
    return enCurso;
  }

  async function descartar() {
    const actual = enCurso;
    enCurso = null;
    const nav = await actual?.catch(() => null);
    await nav?.close?.().catch(() => {});
  }

  return { obtener, descartar };
}
