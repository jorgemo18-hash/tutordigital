// Texto de acompañamiento del email a familias (recibo/informe adjuntos
// como PDF) — un único campo por tenant en academia_config, con variables
// que se sustituyen al enviar. Mismo texto por defecto que la migración
// 091 (duplicado ahí a propósito: SQL no puede importar JS).
export const DEFAULT_TEXTO =
  "Hola {familia}, os adjuntamos el recibo de {mes} ({total}) y el informe del trabajo realizado este mes. " +
  "Cualquier duda, quedamos a vuestra disposición.";

export const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatEuros(n) {
  return `${Number(n || 0).toFixed(2)} €`;
}

// Sustitución literal de {mes}/{anio}/{total}/{familia} — `total` llega ya
// resuelto por el llamador (el importe neto del recibo, o "" si la familia
// no tiene recibo ese mes, ver enviarFamiliaEmail.js) para que esta función
// no necesite saber nada de recibos.
export function sustituirVariables(plantilla, { mes, anio, total, familia }) {
  const base = plantilla || DEFAULT_TEXTO;
  return base
    .split("{mes}").join(MESES[mes] || "")
    .split("{anio}").join(String(anio ?? ""))
    .split("{total}").join(total != null && total !== "" ? formatEuros(total) : "")
    .split("{familia}").join(familia || "");
}
