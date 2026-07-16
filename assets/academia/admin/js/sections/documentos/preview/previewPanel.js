// Zona de vista previa embebida, debajo de las tarjetas de Documentos —
// una única instancia compartida por hojaInscripcionCard.js y
// normasCard.js (ver documentosSection.js), para que "cargar un
// documento sustituye al otro" sea automático sin coordinación extra
// entre las tarjetas: cualquier llamada a abrirCargando/mostrarPdf/
// mostrarAviso revoca primero el blob anterior.
export function buildPreviewPanel() {
  const panel = document.createElement("div");
  panel.className = "ac-doc-preview hidden";

  const head = document.createElement("div");
  head.className = "ac-doc-preview-head";
  const titulo = document.createElement("div");
  titulo.className = "ac-doc-preview-title";
  const acciones = document.createElement("div");
  acciones.className = "ac-doc-preview-actions";

  const imprimirBtn = document.createElement("button");
  imprimirBtn.type = "button";
  imprimirBtn.className = "ac-btn primary sm hidden";
  imprimirBtn.textContent = "Imprimir";

  const descargarBtn = document.createElement("button");
  descargarBtn.type = "button";
  descargarBtn.className = "ac-btn ghost sm hidden";
  descargarBtn.textContent = "Descargar";

  const cerrarBtn = document.createElement("button");
  cerrarBtn.type = "button";
  cerrarBtn.className = "ac-btn ghost sm";
  cerrarBtn.textContent = "Cerrar";

  acciones.append(imprimirBtn, descargarBtn, cerrarBtn);
  head.append(titulo, acciones);

  const body = document.createElement("div");
  body.className = "ac-doc-preview-body";

  panel.append(head, body);

  let blobUrlActual = null;
  let filenameActual = "documento.pdf";
  // true si el blob actual se abrió en una pestaña nueva (fallback de
  // imprimir) — esa pestaña sigue necesitando el object URL vivo mientras
  // esté abierta, así que revocarlo al cerrar/sustituir la preview rompería
  // su descarga con un archivo de 0 bytes (bug real: ver imprimir() más
  // abajo). No hay forma fiable de saber cuándo el usuario cierra esa
  // pestaña, así que este blob concreto deja de revocarse — un leak
  // acotado a como mucho una llamada a imprimir() por documento abierto,
  // preferible a servirle una descarga rota.
  let blobUrlEnUsoExterno = false;

  function revocarBlobActual() {
    if (blobUrlActual && !blobUrlEnUsoExterno) URL.revokeObjectURL(blobUrlActual);
    blobUrlActual = null;
    blobUrlEnUsoExterno = false;
  }

  function ocultarAcciones() {
    imprimirBtn.classList.add("hidden");
    descargarBtn.classList.add("hidden");
  }

  // print() debe llamarse sobre el contentWindow del iframe (imprime solo
  // el PDF, sin cabecera/pie del panel admin alrededor) — si el navegador
  // lo bloquea o el iframe aún no expone contentWindow por el motivo que
  // sea, el fallback es abrir el blob en una pestaña nueva para imprimir
  // desde el visor de PDF nativo de ahí. Esa pestaña queda usando el
  // mismo object URL de forma indefinida (ver blobUrlEnUsoExterno) — marcar
  // esto ANTES de abrir la pestaña, no después, porque window.open() puede
  // disparar la navegación de forma síncrona.
  function imprimir() {
    if (!blobUrlActual) return;
    try {
      const iframe = body.querySelector("iframe");
      if (iframe?.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return;
      }
    } catch {
      // sigue al fallback de abajo
    }
    blobUrlEnUsoExterno = true;
    window.open(blobUrlActual, "_blank");
  }

  function descargar() {
    if (!blobUrlActual) return;
    const a = document.createElement("a");
    a.href = blobUrlActual;
    a.download = filenameActual;
    a.click();
  }

  imprimirBtn.addEventListener("click", imprimir);
  descargarBtn.addEventListener("click", descargar);
  cerrarBtn.addEventListener("click", cerrar);

  // El botón que dispara la carga (Abrir / Ver normas) nunca se
  // deshabilita — el estado de "cargando" vive aquí, en la zona de
  // preview, no congelando el botón (la hoja de inscripción puede tardar
  // por el cold start del microservicio).
  function abrirCargando(tituloTexto) {
    revocarBlobActual();
    panel.classList.remove("hidden");
    titulo.textContent = tituloTexto;
    ocultarAcciones();
    body.innerHTML = "";
    const cargando = document.createElement("div");
    cargando.className = "ac-doc-preview-status";
    const spinner = document.createElement("span");
    spinner.className = "ac-spinner";
    cargando.append(spinner, document.createTextNode(" Generando documento…"));
    body.appendChild(cargando);
  }

  function mostrarError(mensaje, { onReintentar } = {}) {
    ocultarAcciones();
    body.innerHTML = "";
    const err = document.createElement("div");
    err.className = "ac-doc-preview-status error";
    err.textContent = mensaje;
    body.appendChild(err);
    if (onReintentar) {
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "ac-btn ghost sm";
      retryBtn.textContent = "Reintentar";
      retryBtn.addEventListener("click", onReintentar);
      body.appendChild(retryBtn);
    }
  }

  function mostrarPdf({ blob, titulo: tituloTexto, filename }) {
    revocarBlobActual();
    panel.classList.remove("hidden");
    titulo.textContent = tituloTexto;
    filenameActual = filename;
    blobUrlActual = URL.createObjectURL(blob);
    imprimirBtn.classList.remove("hidden");
    descargarBtn.classList.remove("hidden");
    body.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.className = "ac-doc-preview-frame";
    iframe.src = blobUrlActual;
    iframe.title = tituloTexto;
    body.appendChild(iframe);
  }

  // Caso legado: un documento que no es PDF (normas subidas en DOCX antes
  // de que la subida empezara a convertir siempre a PDF) — no se puede
  // embeber en un iframe, solo se ofrece descargarlo. El blob ya viene
  // descargado (mismo fetch que mostrarPdf) para que "Descargar" no
  // dispare una segunda petición.
  function mostrarAviso({ mensaje, blob, titulo: tituloTexto, filename }) {
    revocarBlobActual();
    panel.classList.remove("hidden");
    titulo.textContent = tituloTexto;
    filenameActual = filename;
    blobUrlActual = URL.createObjectURL(blob);
    imprimirBtn.classList.add("hidden");
    descargarBtn.classList.remove("hidden");
    body.innerHTML = "";
    const aviso = document.createElement("div");
    aviso.className = "ac-doc-preview-status";
    aviso.textContent = mensaje;
    body.appendChild(aviso);
  }

  function cerrar() {
    revocarBlobActual();
    panel.classList.add("hidden");
    body.innerHTML = "";
  }

  return { el: panel, abrirCargando, mostrarError, mostrarPdf, mostrarAviso, cerrar };
}
