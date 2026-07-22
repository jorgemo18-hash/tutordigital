// Núcleo de la política forward-only, sin UI propia — lo usa
// regenerarBoton.js (una sola llamada, con botón/spinner) y las
// orquestaciones compuestas de acciones/ (varias llamadas encadenadas,
// cada una con su propio aviso si hace falta) para no reimplementar el
// ciclo "intenta sin confirmar -> si pide confirmación, pregunta -> si
// acepta, reintenta confirmado" en cada sitio que lo necesita.
// `fn(confirmar)` es la llamada real; si lanza un error con
// `code === "requiere_confirmacion"`, se pregunta con `confirmFn` usando
// el texto de `mensajeConfirmacion(err.details)`. Si el usuario cancela
// (o cierra un diálogo previo sin elegir), lanza un error con
// `code === "cancelado"` — nunca un error "real" — para que quien llama
// pueda distinguir cancelación de fallo.
export async function confirmarYEjecutar(fn, {
  mensajeConfirmacion = () => "Esta acción necesita confirmación antes de continuar. ¿Continuar?",
  confirmFn = (mensaje) => window.confirm(mensaje),
} = {}) {
  try {
    return await fn(false);
  } catch (err) {
    if (err.code !== "requiere_confirmacion") throw err;
    if (!confirmFn(mensajeConfirmacion(err.details))) {
      const cancelado = new Error("Acción cancelada.");
      cancelado.code = "cancelado";
      throw cancelado;
    }
    return await fn(true);
  }
}
