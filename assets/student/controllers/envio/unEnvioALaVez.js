// UN MENSAJE AL TUTOR A LA VEZ.
//
// En las conversaciones reales de mayo-junio salieron mensajes duplicados a
// los dos o tres segundos. El botón se deshabilitaba, pero tarde (después de
// pintar el mensaje) y solo el botón: Enter seguía enviando, y con una foto
// adjunta el segundo envío la volvía a encontrar pendiente y la mandaba otra
// vez.
//
// Un cerrojo compartido por las dos entradas (safeSend, que es el botón y
// Enter, y sendText, que usan las tarjetas y el dictado): mientras hay un
// envío en curso, las demás llamadas se ignoran y el texto se queda en el
// cuadro, sin perderse.
export function crearCerrojoDeEnvio() {
  let enCurso = false;
  return {
    get ocupado() { return enCurso; },
    envolver(fn) {
      return async function (...args) {
        if (enCurso) return undefined;
        enCurso = true;
        try {
          return await fn(...args);
        } finally {
          enCurso = false;
        }
      };
    },
  };
}
