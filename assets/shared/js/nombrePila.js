// El nombre de pila de un alumno, para las pantallas donde solo se
// necesita saber QUIÉN viene.
//
// `academia_alumnos.nombre` guarda el nombre completo ("Rakel Trallero
// Gallego"), que es lo correcto para un recibo o un informe. En el
// cuadrante del horario, en cambio, los apellidos solo hacen que el nombre
// no quepa: una columna de día mide ~140px con el menú lateral abierto, y
// ahí "Rakel Trallero Gallego" se corta en "Rakel Trallero…" o peor. En un
// cuadrante de clase se llama a la gente por su nombre — es lo que hace
// Jorge en el cuaderno.
//
// Se queda con la PRIMERA palabra. Un "Juan Carlos" pierde el Carlos, y por
// eso quien la use debe dejar el nombre completo en el `title` del elemento:
// nada se pierde, solo se deja de enseñar de entrada.
export function nombrePila(nombre) {
  const limpio = String(nombre || "").trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  return limpio.split(" ")[0];
}
