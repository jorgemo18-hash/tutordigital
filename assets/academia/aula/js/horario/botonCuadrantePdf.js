// EL BOTÓN DEL CUADRANTE EN PDF.
//
// Sustituye al de "Imprimir" con `window.print()`, y el cambio no es
// cosmético. Imprimiendo la página, el folio no es nuestro: Safari ignora
// `@page` —ni tamaño ni márgenes—, los pone la impresora, y la escala del
// diálogo cambia la geometría después de que la página haya medido. Tres
// intentos de que cupiera en un folio y tres resultados distintos según el
// ajuste (Jorge, 16/09/2026). El PDF lo dibuja el backend en puntos: sale
// igual en cualquier impresora, y la orientación viaja DENTRO del archivo, así
// que no hay diálogo que pueda ponerlo en vertical.
//
// SE ABRE EN UNA PESTAÑA, no se descarga a la fuerza: es el mismo patrón que
// la hoja de inscripción y la de familias (ver hojaFamiliasCard.js). Desde la
// vista previa del navegador se imprime o se guarda, y de paso se puede mandar
// por WhatsApp a un profesor que sustituye.

const TEXTO = "Cuadrante en PDF";
const TEXTO_OCUPADO = "Generando…";

// El object URL se revoca tarde y no al instante: Safari aún está abriendo la
// pestaña cuando volvemos aquí, y revocarlo antes deja la pestaña en blanco.
const MS_ANTES_DE_REVOCAR = 60_000;

export function abrirBlobEnPestana(blob, { ventana = globalThis.window } = {}) {
  const url = URL.createObjectURL(blob);
  ventana.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), MS_ANTES_DE_REVOCAR);
  return url;
}

// `descargarFn` y `onError` se inyectan: así el botón se prueba entero sin red
// y sin navegador, que es donde estaban los fallos de las versiones
// anteriores.
export function buildBotonCuadrantePdf({
  descargarFn,
  opciones = () => ({}),
  onError = null,
  abrirFn = abrirBlobEnPestana,
} = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn ac-btn-imprimir";
  btn.textContent = TEXTO;
  btn.title = "Genera el cuadrante en A4 horizontal, listo para imprimir";

  // Un segundo clic mientras se genera pediría dos PDF y abriría dos pestañas.
  let ocupado = false;
  btn.addEventListener("click", async () => {
    if (ocupado) return;
    ocupado = true;
    btn.disabled = true;
    btn.textContent = TEXTO_OCUPADO;
    try {
      const blob = await descargarFn(opciones());
      abrirFn(blob);
    } catch (err) {
      // El error se enseña donde el usuario está mirando; si nadie pasa un
      // sitio donde enseñarlo, al menos no se traga en silencio.
      if (onError) onError(err?.message || "No se pudo generar el cuadrante.");
      else console.error("cuadrante pdf:", err);
    } finally {
      ocupado = false;
      btn.disabled = false;
      btn.textContent = TEXTO;
    }
  });

  return btn;
}

// La línea que aparece SOLO si alguien pulsa Ctrl+P. La rejilla no se puede
// imprimir (es una caja con scroll) y el folio del navegador no es nuestro, así
// que en vez de dejar que se lleve un papel inútil se le dice dónde está el
// bueno. En pantalla no se ve.
export function buildAvisoDeImpresion() {
  const aviso = document.createElement("p");
  aviso.className = "ac-solo-papel";
  aviso.textContent = 'Para imprimir el cuadrante, usa el botón "Cuadrante en PDF" de la pantalla: sale en A4 horizontal y cabe en un folio.';
  return aviso;
}
