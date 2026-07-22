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

// Botón reutilizable (lote en cabecera, o individual en una tarjeta, tanto
// en modo "generar" como "regenerar" — mismo ciclo, distintos textos/
// acción): idle → cargando (spinner) → ✓ hecho → idle, y el flujo de
// confirmación forward-only cuando el backend responde
// `requiere_confirmacion` (ver apiCore.js, que adjunta `err.code`/
// `err.details` a los errores de callJson). `ejecutar(confirmar)` es la
// llamada API; `mensajeConfirmacion(details)` construye el texto del
// aviso a partir del payload del 409; `confirmFn` es inyectable para tests
// (mismo patrón que descuentosRecurrentesSection.js). `mensajeConfirmacion`
// tiene un valor por defecto porque un uso en modo "generar" (nada que
// sobrescribir) nunca debería necesitarlo — pero si ocurriera igual (p.ej.
// una condición de carrera) no debe reventar por no tener uno.
export function buildRegenerarBoton({
  textoIdle,
  textoCargando = "Regenerando…",
  textoOk = "✓ Regenerado",
  claseExtra = "primary",
  ejecutar,
  mensajeConfirmacion = () => "Esta acción necesita confirmación antes de continuar. ¿Continuar?",
  onError,
  confirmFn = (mensaje) => window.confirm(mensaje),
}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${claseExtra}`;
  setContenido(btn, { texto: textoIdle });

  async function intentar(confirmar) {
    setContenido(btn, { texto: textoCargando, spinner: true });
    try {
      const resultado = await ejecutar(confirmar);
      const texto = typeof textoOk === "function" ? textoOk(resultado) : textoOk;
      setContenido(btn, { texto });
      setTimeout(() => setContenido(btn, { texto: textoIdle }), MENSAJE_OK_MS);
    } catch (err) {
      if (err.code === "requiere_confirmacion" && !confirmar) {
        setContenido(btn, { texto: textoIdle });
        if (confirmFn(mensajeConfirmacion(err.details))) await intentar(true);
        return;
      }
      // "cancelado": el propio `ejecutar` canceló un paso previo (p.ej. el
      // usuario cerró el diálogo de "¿qué quieres enviar?" sin elegir, ver
      // elegirTipoEnvioDialog.js) — no es un fallo real, así que vuelve a
      // idle en silencio, sin pasar por onError.
      setContenido(btn, { texto: textoIdle });
      if (err.code === "cancelado") return;
      onError?.(err);
    }
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    await intentar(false);
    btn.disabled = false;
  });

  return btn;
}
