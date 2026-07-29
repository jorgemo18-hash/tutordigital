import { escHtml } from "../../../assets/shared/js/escHtml.js";

// Textos de acompañamiento del email a familias — uno por cada caso de
// envío posible (recibo+informes, solo recibo, solo informe), NO un único
// campo reutilizado: un texto compartido asumía siempre recibo+informe y
// dejaba huecos ("os adjuntamos el recibo de {mes} ()") cuando el envío
// real solo llevaba uno de los dos. Mismos textos por defecto que la
// migración 092 (duplicado ahí a propósito: SQL no puede importar JS).
export const DEFAULT_TEXTO_COMPLETO =
  "Hola {familia}, os adjuntamos el recibo de {mes} ({total}) y el informe del trabajo realizado este mes. " +
  "Cualquier duda, quedamos a vuestra disposición.";

export const DEFAULT_TEXTO_SOLO_RECIBO =
  "Hola {familia}, os adjuntamos el recibo de {mes} ({total}). Cualquier duda, quedamos a vuestra disposición.";

export const DEFAULT_TEXTO_SOLO_INFORME =
  "Hola {familia}, os adjuntamos el informe del trabajo realizado este mes. Cualquier duda, quedamos a vuestra disposición.";

export const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatEuros(n) {
  return `${Number(n || 0).toFixed(2)} €`;
}

// Sustitución literal de {mes}/{anio}/{total}/{familia} — `total` llega ya
// resuelto por el llamador (el importe neto del recibo, o "" si no aplica,
// ver enviarFamiliaEmail.js) para que esta función no necesite saber nada
// de recibos. `fallback` es el texto por defecto de ESE caso concreto (no
// uno genérico) — si `plantilla` viene vacía (config sin fila todavía) no
// queremos caer en el texto de otro caso por error.
//
// Escapado: solo {familia} (dato de academia_familias.nombre, puede venir
// de import Excel) se escapa antes de sustituir — nunca la plantilla ya
// montada, que es texto libre del admin del propio centro para SU email,
// no de un tercero (escaparla entera además re-escaparía la {familia} ya
// escapada, doble escapado). mes/anio/total no lo necesitan: mes sale de
// MESES (constante fija), anio/total son numéricos formateados aquí mismo.
// El \n -> <br> corre DESPUÉS de la sustitución (recibo/informe llevan
// saltos de línea reales, p. ej. el texto de inscripción) para no
// interferir con el escapado de {familia} ni acabar escapando el <br>
// que acabamos de insertar.
export function sustituirVariables(plantilla, { mes, anio, total, familia }, fallback = DEFAULT_TEXTO_COMPLETO) {
  const base = plantilla || fallback;
  const sustituido = base
    .split("{mes}").join(MESES[mes] || "")
    .split("{anio}").join(String(anio ?? ""))
    .split("{total}").join(total != null && total !== "" ? formatEuros(total) : "")
    .split("{familia}").join(escHtml(familia || ""));
  return sustituido.replaceAll("\n", "<br>");
}
