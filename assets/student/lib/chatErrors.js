export function formatChatError(err, { isPDF, isImage, isDocx } = {}) {
  const status = Number(err?.status || err?.statusCode || err?.response?.status || 0) || 0;
  const code = String(err?.code || "").trim();
  const msg = String(err?.message || "").trim();
  const name = String(err?.name || "").toLowerCase();
  const raw = String(err?._raw || "");
  const combined = `${msg} ${code} ${name} ${raw}`.toLowerCase();

  if (!status && (
      combined.includes("load failed") ||
      combined.includes("failed to fetch") ||
      combined.includes("network") ||
      combined.includes("internet") ||
      combined.includes("cors")
    )) {
    return "Parece un fallo de conexión. Revisa internet y vuelve a enviar el mensaje.";
  }

  const netMsg = (msg || "").toLowerCase();
  const isNetwork =
    status === 0 &&
    (
      netMsg.includes("failed to fetch") ||
      netMsg.includes("load failed") ||
      netMsg.includes("networkerror") ||
      netMsg.includes("network error") ||
      netMsg.includes("connection") ||
      netMsg.includes("conexión") ||
      netMsg.includes("corte") ||
      netMsg.includes("lost") ||
      netMsg.includes("offline") ||
      netMsg.includes("cors")
    );

  if (isNetwork) {
    return "Se ha perdido la conexión (o el servidor no responde). Reintenta en unos segundos. Si estás en móvil, prueba a cambiar de Wi-Fi/datos.";
  }

  if (status === 504 || /timeout/i.test(code) || /timed out/i.test(msg)) {
    if (isPDF || isDocx) {
      return "Ha tardado demasiado en procesar ese archivo. Prueba con un PDF más pequeño o envíame una foto de la página concreta.";
    }
    if (isImage) {
      return "Ha tardado demasiado en procesar la imagen. Reintenta (si pesa mucho, manda una foto más ligera o recortada).";
    }
    return "Ha tardado demasiado en responder. Reintenta en unos segundos.";
  }

  if (isPDF) {
    if (
      /unsupported|invalid_request|file|mime|format/i.test(code) ||
      /no contiene base64|dataurl|unsupported|invalid|file|pdf/i.test(msg) ||
      status === 400
    ) {
      return "Ese PDF ahora mismo no lo puedo leer. Prueba a exportarlo como PDF otra vez o envíame una foto de la página.";
    }
    if (status === 413 || /too large|payload too large|maximum/i.test(msg)) {
      return "El PDF es demasiado grande. Prueba con uno más pequeño o envía una foto de la página.";
    }
  }

  if (isDocx) {
    if (
      /unsupported|invalid_request|file|mime|format/i.test(code) ||
      /unsupported|invalid|file|docx|word/i.test(msg) ||
      status === 400
    ) {
      return "Ese DOCX ahora mismo no lo puedo leer bien. Prueba a exportarlo como PDF o envíame una foto de la página.";
    }
    if (status === 413 || /too large|payload too large|maximum/i.test(msg)) {
      return "El DOCX es demasiado grande. Prueba a exportarlo como PDF más pequeño o envía una foto de la página.";
    }
  }

  if (code === "invalid_api_key" || code === "authentication_error" || status === 401) {
    return "Ahora mismo el servicio no puede responder. Inténtalo otra vez en un minuto.";
  }

  if (code === "daily_limit_reached") {
    return "Has alcanzado el límite de mensajes de hoy 📚 Vuelve mañana para seguir practicando.";
  }

  if (code === "rate_limit_exceeded" || status === 429) {
    return "Hay mucha carga ahora mismo. Espera unos segundos y prueba otra vez.";
  }

  if (status >= 500) {
    return "Ha ocurrido un error en el servidor. Reintenta en unos segundos.";
  }

  return "No he podido responder ahora mismo.";
}