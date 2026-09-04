import { NIVELES, esNivel } from "./niveles.js";

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
// UNA HORA PUEDE TENER VARIOS CURSOS, y esto no es un capricho: es lo que
// hace que el modelo aguante una academia con más de un profesor. Si a las
// 16:00 una profesora lleva Primaria y otro lleva ESO, la hora del CENTRO
// ofrece las dos cosas. Guardar un solo curso por hora obligaría a elegir
// cuál de las dos mentir. Y guardarlo por profesor sería peor: a la familia
// que pregunta no le importa quién da la clase, le importa si su hijo de
// 4º de Primaria puede venir a las cuatro.
//
// LA FORMA. Un objeto plano, día y hora de inicio del bloque como clave, y
// la lista de cursos como valor:
//
//   { "1|15:30": ["primaria"], "1|16:30": ["primaria", "eso"] }
//
// Se guarda por HORA DE INICIO y no por índice de fila, por lo mismo que
// los precios van por id: cambiar la apertura del centro en Ajustes movería
// todas las reservas una fila si fueran por posición, y el papel diría que
// Primaria viene a una hora a la que ya no viene. Por hora de inicio, una
// reserva que se queda sin su bloque sencillamente desaparece — que es lo
// correcto: esa hora ya no existe.

const ORDEN = NIVELES.map((n) => n.id);

export function claveReserva(dia, horaInicio) {
  return `${Number(dia)}|${String(horaInicio || "").slice(0, 5)}`;
}

// Solo entran claves con forma de día+hora y niveles que existan de verdad.
// Un jsonb heredado o escrito a mano no puede colar "lunes tarde" como si
// fuera una reserva.
const CLAVE_RE = /^[1-7]\|([01]\d|2[0-3]):[0-5]\d$/;

// Se acepta también un nivel suelto ("primaria") y no solo una lista: es la
// forma que tenía este objeto antes de admitir varios cursos por hora, y
// leerla cuesta una línea. Al guardar sale siempre como lista.
function nivelesDeValor(valor) {
  const lista = Array.isArray(valor) ? valor : [valor];
  const vistos = lista.filter(esNivel);
  return ORDEN.filter((id) => vistos.includes(id));
}

export function normalizarReservas(raw) {
  const reservas = {};
  for (const [clave, valor] of Object.entries(raw || {})) {
    if (!CLAVE_RE.test(clave)) continue;
    const niveles = nivelesDeValor(valor);
    if (niveles.length) reservas[clave] = niveles;
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

export function nivelesDe(reservas, dia, bloque) {
  return reservas?.[claveReserva(dia, bloque?.inicio)] || [];
}

// Marca o desmarca un curso en una hora. Quedarse sin ningún curso BORRA la
// entrada en vez de dejar una lista vacía: así el objeto solo contiene
// horas de verdad reservadas y hayReservas() dice la verdad, que es lo que
// decide si la hoja se imprime como rejilla o como lista de horas.
export function alternarNivel(reservas, dia, bloque, nivel) {
  if (!esNivel(nivel)) return normalizarReservas(reservas);
  const siguiente = { ...normalizarReservas(reservas) };
  const clave = claveReserva(dia, bloque?.inicio);
  const actuales = siguiente[clave] || [];
  const niveles = actuales.includes(nivel)
    ? actuales.filter((n) => n !== nivel)
    : ORDEN.filter((id) => id === nivel || actuales.includes(id));
  if (niveles.length) siguiente[clave] = niveles;
  else delete siguiente[clave];
  return siguiente;
}

export function hayReservas(reservas) {
  return Object.keys(normalizarReservas(reservas)).length > 0;
}

// Una hora con TODOS los cursos marcados es una hora abierta a cualquiera:
// dice exactamente lo mismo que una sin marcar, así que cuenta como
// abierta. Si no, marcar los tres por completar la rejilla imprimiría
// "Prim. · ESO · Bach." en una casilla donde cabe "Todos".
export function esHoraAbierta(niveles) {
  return !niveles?.length || niveles.length >= ORDEN.length;
}
