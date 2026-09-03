import { esNivel } from "./niveles.js";

// Horas reservadas para un curso: "los lunes a las 17:30 solo viene
// Primaria".
//
// PARA QUÉ. Hay academias que separan por niveles en vez de mezclarlos:
// una hora para Primaria, la siguiente para la ESO. Eso es lo primero que
// pregunta un padre y lo que va escrito en la hoja que se le entrega. Sin
// esto, la hoja solo puede decir el horario de apertura, que no le sirve
// para saber cuándo puede venir su hijo.
//
// LO QUE ESTO NO ES. No bloquea nada. Es una ETIQUETA para la hoja: marcar
// el lunes a las 17:30 como Primaria no impide meter ahí a un alumno de la
// ESO desde el cuadrante, ni avisa. Si algún día se quiere que avise, será
// una comprobación aparte que lea esto — pero mientras tanto conviene no
// confundir un rótulo impreso con una regla del sistema.
//
// LA FORMA. Un objeto plano, día y hora de inicio del bloque como clave:
//
//   { "1|15:30": "primaria", "1|16:30": "eso" }
//
// Se guarda por HORA DE INICIO y no por índice de fila, por lo mismo que
// los precios van por id: cambiar la apertura del centro en Ajustes movería
// todas las reservas una fila si fueran por posición, y el papel diría que
// Primaria viene a una hora a la que ya no viene. Por hora de inicio, una
// reserva que se queda sin su bloque sencillamente desaparece — que es lo
// correcto: esa hora ya no existe.

export function claveReserva(dia, horaInicio) {
  return `${Number(dia)}|${String(horaInicio || "").slice(0, 5)}`;
}

// Solo entran claves con forma de día+hora y valores que sean un nivel de
// verdad. Un jsonb heredado o escrito a mano no puede colar "lunes tarde"
// como si fuera una reserva.
const CLAVE_RE = /^[1-7]\|([01]\d|2[0-3]):[0-5]\d$/;

export function normalizarReservas(raw) {
  const reservas = {};
  for (const [clave, valor] of Object.entries(raw || {})) {
    if (!CLAVE_RE.test(clave) || !esNivel(valor)) continue;
    reservas[clave] = valor;
  }
  return reservas;
}

// Las reservas que siguen teniendo sitio en el horario actual del centro.
// Se limpian al guardar desde Ajustes: si no, cambiar la apertura dejaría
// en la base de datos reservas de horas que ya no existen, arrastradas para
// siempre y sin forma de verlas ni de borrarlas.
export function reservasVigentes(reservas, { dias = [], bloques = [] } = {}) {
  const validas = new Set(
    dias.flatMap((dia) => bloques.map((bloque) => claveReserva(dia, bloque.inicio)))
  );
  const vigentes = {};
  for (const [clave, valor] of Object.entries(normalizarReservas(reservas))) {
    if (validas.has(clave)) vigentes[clave] = valor;
  }
  return vigentes;
}

export function reservaDe(reservas, dia, bloque) {
  return reservas?.[claveReserva(dia, bloque?.inicio)] || "";
}

// Un nivel vacío BORRA la reserva en vez de guardar "": así el objeto solo
// contiene horas de verdad reservadas y hayReservas() dice la verdad, que
// es lo que decide si la hoja se imprime como rejilla o como lista.
export function conReserva(reservas, dia, bloque, nivel) {
  const siguiente = { ...normalizarReservas(reservas) };
  const clave = claveReserva(dia, bloque?.inicio);
  if (esNivel(nivel)) siguiente[clave] = nivel;
  else delete siguiente[clave];
  return siguiente;
}

export function hayReservas(reservas) {
  return Object.keys(normalizarReservas(reservas)).length > 0;
}
