import { confirmarYEjecutar } from "./confirmarYEjecutar.js";

const MENSAJE_OK_MS = 1700;

function setContenido(btn, { texto, spinner = false }) {
  btn.innerHTML = "";
  if (spinner) {
    const sp = document.createElement("span");
    sp.className = "ac-spinner";
    btn.appendChild(sp);
  }
  btn.appendChild(document.createTextNode(texto));
}

// Botón reutilizable (lote en cabecera, individual en una tarjeta, o
// compuesto en acciones/ — mismo ciclo, distintos textos/acción): idle →
// cargando (spinner) → ✓ hecho → idle. La política forward-only del ciclo
// (qué pasa si el backend responde `requiere_confirmacion`) vive en
// confirmarYEjecutar.js, reutilizada aquí — este componente solo añade el
// estado visual del botón encima. `ejecutar(confirmar)` es la llamada API;
// `mensajeConfirmacion(details)` construye el texto del aviso a partir del
// payload del 409; `confirmFn` es inyectable para tests (mismo patrón que
// descuentosRecurrentesSection.js). Si `ejecutar` ya gestiona su propia
// confirmación internamente (varias llamadas encadenadas, ver
// acciones/accionesLote.js y acciones/accionesFamilia.js) puede devolver o
// lanzar directamente sin pasar por un segundo ciclo aquí — el código
// `cancelado` (el usuario cerró un diálogo previo sin elegir, ver
// elegirAccionDialog.js) siempre vuelve a idle en silencio, sin onError.
export function buildRegenerarBoton({
  textoIdle,
  textoCargando = "Regenerando…",
  textoOk = "✓ Regenerado",
  claseExtra = "primary",
  ejecutar,
  mensajeConfirmacion,
  onError,
  confirmFn,
}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${claseExtra}`;
  setContenido(btn, { texto: textoIdle });

  async function intentar() {
    setContenido(btn, { texto: textoCargando, spinner: true });
    try {
      const resultado = await confirmarYEjecutar(ejecutar, { mensajeConfirmacion, confirmFn });
      const texto = typeof textoOk === "function" ? textoOk(resultado) : textoOk;
      setContenido(btn, { texto });
      setTimeout(() => setContenido(btn, { texto: textoIdle }), MENSAJE_OK_MS);
    } catch (err) {
      setContenido(btn, { texto: textoIdle });
      if (err.code === "cancelado") return;
      onError?.(err);
    }
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    await intentar();
    btn.disabled = false;
  });

  return btn;
}
