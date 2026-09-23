import { explicaApartado } from "./explicacion.js";

// UN APARTADO RESUELTO EN CADA ACTIVIDAD.
//
// Jorge, el 17/9: *"habría que hacer un ejemplo (siempre) de cada ejercicio,
// porque un ejemplo global no sirve para algún ejercicio... si el ejercicio
// tiene cinco apartados, uno resuelto y los otros para que los haga"*.
//
// Tiene razón y el motivo se ve en la hoja que había: arriba hay UN ejemplo
// resuelto, de sumar y restar, y debajo seis actividades de las que cinco no
// son sumas. Ese ejemplo no ayuda con la regla de los signos ni con `-3^2`.
//
// TRES DECISIONES QUE MERECEN EXPLICACIÓN:
//
// 1. EL EJEMPLO ES UN APARTADO DE MÁS, NO UNO DE LOS QUE HABÍA. Si de los seis
//    apartados uno se dedica al ejemplo, quedan cinco de práctica, y en las
//    baterías que garantizan las cuatro combinaciones de signos eso se lleva
//    una de las cuatro por delante: la batería deja de diagnosticar. Así que
//    se piden `cuantos + 1` y el ejemplo es el extra.
//
// 2. SE COGE EL ÚLTIMO, NO EL PRIMERO. Los generadores colocan sus casos
//    obligatorios en los primeros puestos (los cuatro signos, la base
//    negativa con exponente par...) y sortean el resto. El último es por
//    tanto un caso libre, así que usarlo como ejemplo deja intactos TODOS los
//    obligatorios en la parte de práctica. Cogerlo del principio habría
//    tenido el mismo problema que el punto 1.
//
// 3. EL EJEMPLO VA PRIMERO EN LA HOJA. Un ejemplo después de los ejercicios
//    es una solución, no un ejemplo.

// Las baterías que NO llevan ejemplo, y por qué:
//
// `pares_con_y_sin_parentesis` ES el ejemplo. Su contenido es comparar
// `(-3)^2` con `-3^2`, así que resolver uno de los dos miembros de una pareja
// regala justo lo que el alumno tiene que descubrir. Y además sus apartados
// van de dos en dos: uno de más rompe las filas.
export const SIN_EJEMPLO = new Set(["pares_con_y_sin_parentesis"]);

// Marca un apartado como resuelto: se imprime con la respuesta puesta y con
// una línea de explicación debajo.
export function comoResuelto(apartado) {
  if (!apartado) return null;
  return {
    ...apartado,
    resuelto: true,
    // `latexResuelto` lo construye quien crea el apartado, donde están el
    // árbol y el estilo (ver ejercicio.js y generadores/hueco.js). Si
    // faltara, el ejemplo se imprime igual pero con el hueco — mejor un
    // ejemplo pobre que una cadena a medio parchear.
    latex: apartado.latexResuelto || apartado.latex,
    // `razon` la trae escrita el generador cuando el apartado NO es una
    // expresión (ordenar una lista, el opuesto de un número, una situación
    // cotidiana): ahí no hay árbol que explicar, y quien sabe por qué la
    // respuesta es esa es el generador que la ha construido.
    explicacion: apartado.razon || explicaApartado(apartado),
  };
}

// Envuelve un generador para que su batería salga con un apartado resuelto
// delante.
//
// `cuantos` es OBLIGATORIO y no tiene valor por defecto a propósito: quien
// llama es el montador, que decide el tamaño de la batería según cómo lleve el
// alumno el objetivo (Jorge: *"si lo lleva muy mal, bastantes ejercicios con
// explicación y ejemplos, si solo falla a veces menos ejercicios"*). Un valor
// por defecto aquí sería un tamaño decidido en el sitio equivocado.
export function conEjemploResuelto(generador, azar, opciones = {}) {
  const { cuantos, ...resto } = opciones;
  if (!Number.isInteger(cuantos) || cuantos < 1) {
    throw new Error("conEjemploResuelto necesita `cuantos` (lo decide el montador)");
  }

  const ejercicio = generador(azar, { ...resto, cuantos: cuantos + 1 });
  if (SIN_EJEMPLO.has(ejercicio.clave)) return generador(azar, { ...resto, cuantos });

  const todos = ejercicio.apartados || [];
  // Si el generador no ha conseguido el apartado de más (restricciones muy
  // apretadas, ver `reuneApartados`), la batería sale SIN ejemplo antes que
  // corta: el ejemplo es una ayuda, la práctica es el ejercicio.
  if (todos.length <= cuantos) return ejercicio;

  const ejemplo = comoResuelto(todos[todos.length - 1]);
  const practica = todos.slice(0, -1);
  return { ...ejercicio, apartados: [ejemplo, ...practica], llevaEjemplo: true };
}
