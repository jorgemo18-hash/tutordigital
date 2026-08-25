// Origen único de la URL del microservicio de PDF.
//
// Antes, cinco rutas repetían `process.env.PDF_SERVICE_URL || "http://localhost:3002"`
// (normas, hojaInscripcion, informes, recibos/marcarPago, recibos/enviar).
// Si la variable faltaba o venía mal escrita en Render, el backend arrancaba
// sin quejarse y cada envío intentaba hablar con localhost, fallaba, y
// reintentaba varias veces — decenas de segundos por documento y ninguna
// pista en pantalla de cuál era la causa real.
//
// El fallback a localhost se mantiene SOLO fuera de producción, que es donde
// tiene sentido (el microservicio corriendo en la máquina del desarrollador).
// En producción la variable es obligatoria y se comprueba al arrancar, no en
// el primer envío del mes: ver validateStartupEnv() en lib/env.js.
export const PDF_SERVICE_URL_DEV_FALLBACK = "http://localhost:3002";

export function getPdfServiceUrl() {
  const value = String(process.env.PDF_SERVICE_URL || "").trim();
  if (value) return value.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    // No debería llegar aquí: validateStartupEnv() aborta el arranque. Si
    // llega (proceso arrancado sin esa validación), es preferible un error
    // explícito que apuntar en silencio a un localhost que no existe.
    throw new Error("Missing env: PDF_SERVICE_URL");
  }
  return PDF_SERVICE_URL_DEV_FALLBACK;
}
