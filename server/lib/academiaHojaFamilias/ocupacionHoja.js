import { ocupacionDeBloque } from "../../../assets/shared/js/horarioBloques.js";

// Cuántos alumnos hay a la vez en cada casilla del horario (día × hora), y
// si esa casilla está completa.
//
// PARA QUÉ. Es lo que Jorge llevaba a mano en su hoja de cálculo: cuando
// una madre pregunta, él no se acuerda de cuántos huecos quedan el martes a
// las cinco, y con la rejilla delante lo ve de un vistazo — y la madre ve
// enseguida qué días puede traer a su hijo.
//
// LA CUENTA ES LA MISMA QUE LA DEL CUADRANTE (`ocupacionDeBloque`): el
// máximo por tramo de media hora dentro de la hora, no cuántas clases la
// tocan. Cuatro clases pueden pasar por una hora sin coincidir nunca más de
// dos, y contarlas todas diría que está llena cuando no lo está. Si esto se
// calculara aparte, la hoja impresa y la pantalla acabarían diciendo cosas
// distintas del mismo martes.

export function clave(dia, bloque) {
  return `${Number(dia)}|${bloque?.inicio}`;
}

// De las franjas vigentes, las que de verdad ocupan una plaza.
//
// `fecha_fin is null` (que filtra la consulta) dice que la franja sigue
// viva, pero no que su alumno esté dentro: un BORRADOR conserva su horario
// —es un alta a medias y tener el hueco apuntado es lo correcto— y todavía
// no ocupa sitio. La hoja los contaba (08/09/2026), así que marcaba como
// completas horas en las que sí quedaba plaza. En Lyceo eran 17 franjas de
// 73, y cambiaba 5 horas marcadas por las 3 reales.
//
// Está aquí, y no como una línea suelta en la ruta, porque es la misma
// decisión que toma el cuadrante de pantalla (academia.horario.routes.js) y
// las dos tienen que responder igual. Una regla de negocio escrita dos veces
// en dos sitios distintos es una regla que va a divergir.
//
// `!== false` y no `=== true`: si el alumno no se pudo embeber, la franja
// cuenta. Quedarse corto en un aforo es peor que pasarse.
export function franjasQueOcupanPlaza(filas = []) {
  return (filas || []).filter((fila) => fila?.alumno?.activo !== false);
}

// `franjas`: filas de academia_horario vigentes, con dia_semana, hora_inicio
// y hora_fin. Devuelve un Map de "dia|HH:MM" a número de alumnos a la vez.
export function ocupacionPorCasilla(franjas, { dias = [], bloques = [] } = {}) {
  const porDia = new Map(dias.map((dia) => [Number(dia), []]));
  for (const franja of franjas || []) {
    const dia = Number(franja?.dia_semana);
    if (porDia.has(dia)) porDia.get(dia).push(franja);
  }

  const mapa = new Map();
  for (const dia of dias) {
    for (const bloque of bloques) {
      mapa.set(clave(dia, bloque), ocupacionDeBloque(porDia.get(Number(dia)) || [], bloque));
    }
  }
  return mapa;
}

// Sin límite de plazas configurado NO se marca nada, y no es una excepción
// rara: es que sin tope no existe la idea de "completa". Un centro que no ha
// puesto máximo por franja no puede decir que una hora esté llena, así que
// su hoja sale con la rejilla limpia.
export function estaCompleta(ocupacion, maxPorFranja) {
  const max = Number(maxPorFranja) || 0;
  return max > 0 && Number(ocupacion || 0) >= max;
}
