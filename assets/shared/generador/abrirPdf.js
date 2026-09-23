// ABRIR EL PDF DE LA HOJA para imprimirlo.
//
// La pestaña se abre AL PULSAR, antes de pedir el PDF, y luego se le pone la
// dirección: Safari (y Chrome con el bloqueador) no deja abrir una pestaña
// que no salga directamente de un clic, y el PDF tarda unos segundos. Si aun
// así no se puede abrir, el PDF se descarga.
export async function abrirPdf({ pedirPdfFn, win = globalThis.window, doc = globalThis.document }) {
  const pestana = win.open("", "_blank");
  try {
    pestana?.document?.write?.("<p style=\"font:16px system-ui;padding:24px\">Preparando el PDF de la hoja…</p>");
  } catch { /* la pestaña puede no dejar escribir: no pasa nada */ }
  try {
    const blob = await pedirPdfFn();
    const url = win.URL.createObjectURL(blob);
    if (pestana && !pestana.closed) {
      pestana.location.href = url;
    } else {
      const a = doc.createElement("a");
      a.href = url;
      a.download = "hoja-de-ejercicios.pdf";
      doc.body.appendChild(a);
      a.click();
      a.remove();
    }
    // Se libera más tarde: la pestaña tiene que haber cargado el PDF antes.
    win.setTimeout(() => win.URL.revokeObjectURL(url), 60000);
  } catch (err) {
    pestana?.close?.();
    throw err;
  }
}
