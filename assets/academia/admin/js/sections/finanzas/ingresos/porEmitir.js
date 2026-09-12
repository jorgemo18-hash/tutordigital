import { MESES } from "../../envioFamilias/periodoSelector.js";

// "POR EMITIR": lo que se va a cobrar este mes y todavía no tiene recibo.
//
// EL PROBLEMA (Jorge, 12/09/2026): *"las finanzas no se sincronizan con los
// datos de los alumnos, no me aparece nada"*. No era sincronización: esta
// vista se construye desde los recibos, Lyceo no tiene ni uno emitido, y las
// cuatro tarjetas decían **"Sin alumnos con este método de pago"** — que es
// falso. Había 13 domiciliados, 6 de Bizum, 5 en efectivo y 1 por
// transferencia, cada uno con su tarifa. Lo que no existía era el lote.
//
// Una pantalla de dinero que dice "no hay datos" cuando lo que falta es una
// acción tuya no es un hueco vacío: es una pantalla que miente. Y cuesta
// media hora buscando un fallo que no está.
//
// DOS SITUACIONES DISTINTAS, DOS MENSAJES DISTINTOS, y la diferencia
// importa:
//
//   - el mes NO tiene ningún recibo -> es lo normal antes de cerrar el mes;
//     el aviso informa y dice dónde se generan.
//   - el mes SÍ tiene recibos y aun así quedan familias fuera -> eso es un
//     alumno que se ha quedado sin facturar (se matriculó después de generar
//     el lote, por ejemplo). No es informativo: es dinero que se pierde si
//     nadie lo mira, y el aviso lo dice con esas palabras.
//
// EL IMPORTE VIENE DEL BACKEND, calculado con la MISMA función que emite los
// recibos (ver porEmitir.js / totalesFamilia.js). No se recalcula aquí con
// el bruto y el descuento de tarifa: eso ignoraría los descuentos
// recurrentes y la pantalla prometería más de lo que luego se cobra.

function euros(valor) {
  return `${Number(valor || 0).toFixed(2)} €`;
}

function plural(n, singular, pluralForma) {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

// El texto del aviso. Separado del DOM para poder comprobarlo sin montar
// nada, que es donde están las decisiones de esta pantalla.
export function textoPorEmitir({ porEmitir, hayEmitidos, mes, anio }) {
  const { familias = 0, alumnos = 0, importe = 0 } = porEmitir || {};
  if (!familias) return "";
  const periodo = `${(MESES[mes] || "").toLowerCase()} de ${anio}`;
  const cuanto = `${plural(alumnos, "alumno", "alumnos")} de ${plural(familias, "familia", "familias")}, ${euros(importe)}`;

  if (!hayEmitidos) {
    return `Todavía no has generado los recibos de ${periodo}. Está por facturar ${cuanto}. Los recibos se generan en «Envío a familias».`;
  }
  return `Ojo: ${plural(familias, "familia se ha quedado", "familias se han quedado")} sin recibo de ${periodo} — ${cuanto}. Suele pasar con quien se matricula después de generar el lote.`;
}

export function buildAvisoPorEmitir({ porEmitir, hayEmitidos, mes, anio }) {
  const texto = textoPorEmitir({ porEmitir, hayEmitidos, mes, anio });
  if (!texto) return null;

  const aviso = document.createElement("p");
  // Con recibos ya emitidos es un problema y se pinta como tal; sin ninguno
  // es el estado normal del mes antes de cerrarlo y basta con informar.
  aviso.className = hayEmitidos ? "ac-aviso-mes ac-aviso-mes--alerta" : "ac-aviso-mes";
  aviso.setAttribute("role", "status");
  aviso.textContent = texto;
  return aviso;
}

// La línea del pie de cada tarjeta de método: "Por emitir · 13 alumnos ·
// 1.280,00 €". Va DEBAJO de los cobrados y con su propio rótulo, nunca
// sumada al contador de arriba: "cobrado" y "se va a cobrar" no pueden
// acabar en la misma cifra (esa distinción es la del devengo vs caja que
// está pendiente de preguntar al gestor).
export function buildPiePorEmitir(grupo) {
  if (!grupo || !grupo.alumnos) return null;
  const pie = document.createElement("div");
  pie.className = "ac-pago-grupo-poremitir";

  const rotulo = document.createElement("span");
  rotulo.className = "ac-pago-poremitir-rotulo";
  rotulo.textContent = "Por emitir";

  const dato = document.createElement("span");
  dato.textContent = `${plural(grupo.alumnos, "alumno", "alumnos")} · ${euros(grupo.importe)}`;

  pie.append(rotulo, dato);
  return pie;
}

// Índice metodo_pago -> grupo por emitir, para que la tarjeta de cada método
// encuentre el suyo sin recorrer la lista.
export function indicePorEmitir(porEmitir) {
  return new Map((porEmitir?.grupos || []).map((g) => [g.metodo_pago, g]));
}
