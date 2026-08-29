import { toMinutos, toHHMM, generarHoras } from "./horarioFranjas.js";

// Una clase ya no es "una casilla de la rejilla".
//
// Hasta ahora `franja_duracion` hacía dos trabajos a la vez: dibujaba las
// filas de la rejilla Y decidía cuánto duraba una clase. Con franjas de una
// hora empezando y media, una alumna que solo puede de 16:00 a 17:00 no
// cabía en ninguna casilla: no había forma de meterla, ni desde la ficha ni
// desde el horario.
//
// A partir de aquí:
//   - la rejilla se dibuja SIEMPRE en tramos de media hora (PASO_MIN). En
//     una academia española todas las horas de entrada son en punto o y
//     media; con media hora se puede expresar cualquiera de las dos sin
//     inventar un ajuste más que configurar;
//   - una clase es un GRUPO DE TRAMOS CONTIGUOS. 16:00-17:30 son tres
//     casillas seguidas y una sola fila en academia_horario;
//   - `franja_duracion` pasa a ser la duración ESTÁNDAR de una clase: lo
//     que se marca de un clic. Ajustar media hora arriba o abajo es
//     desmarcar una casilla.
//
// La consecuencia menos evidente, y la más importante: la OCUPACIÓN deja de
// poder contarse por hora de inicio. Quien viene de 16:00 a 17:00 y quien
// viene de 16:30 a 17:30 comparten aula media hora, y contando por hora de
// inicio esos dos alumnos no se ven nunca — el aviso de "franja llena"
// mentiría. Se cuenta por TRAMO cubierto, que es lo que de verdad ocupa el
// aula.

export const PASO_MIN = 30;

// Los tramos de media hora que cubre una franja: [16:00, 17:30) -> 16:00,
// 16:30, 17:00. El final es abierto a propósito — quien acaba a las 17:30
// no ocupa el aula a las 17:30, que es cuando entra el siguiente.
//
// Sin `horaFin` (una fila antigua, o un dato a medias) se devuelve solo el
// tramo de inicio: es lo que se venía contando hasta ahora, así que en el
// peor caso el comportamiento es el de antes, nunca peor.
export function tramosDe(horaInicio, horaFin, paso = PASO_MIN) {
  const inicio = toMinutos(horaInicio);
  if (!horaFin) return [toHHMM(inicio)];
  const fin = toMinutos(horaFin);
  if (!(fin > inicio)) return [toHHMM(inicio)];
  const tramos = [];
  for (let t = inicio; t < fin; t += paso) tramos.push(toHHMM(t));
  return tramos;
}

// Las filas de la rejilla de UN tramo de apertura. Se separa de
// generarHoras para que quede escrito en un solo sitio que la rejilla va
// por PASO_MIN y no por la duración de la clase — que es justo la
// confusión que había antes.
export function filasDeRejilla(franjaInicio, franjaFin, paso = PASO_MIN) {
  return generarHoras(franjaInicio || "15:30", franjaFin || "20:30", paso);
}

// Los tramos de apertura del centro: uno (jornada continua) o dos (jornada
// partida, mañana y tarde — migración 111). El segundo es opcional y
// nullable: la inmensa mayoría de academias abren solo por la tarde, y
// obligarlas a rellenar dos rangos sería papeleo.
//
// El hueco del mediodía NO es una fila vacía de la rejilla: sencillamente
// no existe. Pintarlo obligaría a mirar veinte filas muertas cada vez que
// se cuadra un horario, que es exactamente lo que hace ilegible el
// cuadrante de un centro que abre de 9 a 21.
export function tramosApertura(config = {}) {
  const tramos = [[config.franja_inicio || "15:30", config.franja_fin || "20:30"]];
  if (config.franja_inicio_2 && config.franja_fin_2) {
    tramos.push([config.franja_inicio_2, config.franja_fin_2]);
  }
  return tramos.filter(([i, f]) => toMinutos(f) > toMinutos(i));
}

// Todas las filas de la rejilla del centro, en orden y sin repetir. Si los
// dos tramos se solapan (un dedazo en Ajustes), la fila aparece una sola
// vez en vez de duplicar media rejilla.
export function filasDeRejillaDeConfig(config = {}, paso = PASO_MIN) {
  const filas = new Set();
  for (const [inicio, fin] of tramosApertura(config)) {
    for (const hora of filasDeRejilla(inicio, fin, paso)) filas.add(hora);
  }
  return [...filas].sort();
}

// Cuántas casillas ocupa una clase estándar. Mínimo una: una duración mal
// configurada (0, vacía, un texto) no puede dejar de marcar nada al hacer
// clic.
export function celdasPorClase(franjaDuracion, paso = PASO_MIN) {
  const duracion = Number(franjaDuracion) || paso;
  return Math.max(1, Math.round(duracion / paso));
}

// De casillas marcadas a filas de academia_horario: las contiguas del mismo
// día se funden en UNA franja. Sin esto, una clase de hora y media serían
// tres filas de media hora en la base de datos — tres franjas para el
// profesor, tres apuntes en el horario del centro y tres veces el mismo
// alumno en el cuadrante.
//
// `celdas`: [{dia_semana, hora_inicio}] en cualquier orden.
export function fusionarCeldas(celdas, paso = PASO_MIN) {
  const porDia = new Map();
  for (const celda of celdas || []) {
    const dia = Number(celda?.dia_semana);
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(toMinutos(celda?.hora_inicio));
  }

  const franjas = [];
  for (const [dia, minutos] of [...porDia.entries()].sort((a, b) => a[0] - b[0])) {
    const ordenados = [...new Set(minutos)].sort((a, b) => a - b);
    let inicio = null;
    let anterior = null;
    for (const m of ordenados) {
      if (inicio === null) {
        inicio = m;
      } else if (m !== anterior + paso) {
        // Hueco: la clase anterior termina donde acababa su último tramo.
        franjas.push({ dia_semana: dia, hora_inicio: toHHMM(inicio), hora_fin: toHHMM(anterior + paso) });
        inicio = m;
      }
      anterior = m;
    }
    if (inicio !== null) {
      franjas.push({ dia_semana: dia, hora_inicio: toHHMM(inicio), hora_fin: toHHMM(anterior + paso) });
    }
  }
  return franjas;
}

// El camino de vuelta: qué casillas hay que marcar para representar las
// franjas que ya tiene el alumno. `clave` es la misma de siempre
// (`dia|HH:MM`) para no traducir entre pantallas.
export function celdasDeFranjas(franjas, paso = PASO_MIN) {
  const celdas = new Map();
  for (const f of franjas || []) {
    for (const tramo of tramosDe(f?.hora_inicio, f?.hora_fin, paso)) {
      celdas.set(`${Number(f?.dia_semana)}|${tramo}`, f);
    }
  }
  return celdas;
}
