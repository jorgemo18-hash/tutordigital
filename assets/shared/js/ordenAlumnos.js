// El orden en que se leen los nombres de alumno en pantalla.
//
// POR QUÉ EXISTE (Jorge, 11/09/2026): *"o por hora, o por orden alfabético
// o algo, pero sí que los nombres estén ordenados"*. En el cuadrante salían
// en el orden en que los devuelve la consulta —que para el nombre no es
// ningún orden, porque el `order` de academia.horario.routes.js es por día y
// hora— así que dentro de una misma celda el orden era arbitrario, podía
// cambiar entre dos cargas, y buscar a un alumno obligaba a leerse la celda
// entera. Con seis o siete nombres por hueco eso es el trabajo de cada día.
//
// SE ORDENA POR EL NOMBRE COMPLETO TAL COMO SE GUARDA ("Ana García"), no
// por apellido. En el cuadrante del profesor solo se ve el nombre de pila
// (ver nombrePila.js): ordenar por apellido dejaría a la vista una lista que
// parece desordenada. Y dos Danieles quedan juntos, que es cuando hace
// falta mirar el apellido.
//
// `localeCompare(..., "es")` y no `<` entre cadenas: comparando en crudo,
// "Álex" se va detrás de "Zoe" —el acento manda sobre la letra— y "álvaro"
// detrás de "Ana" por la mayúscula. Es el mismo criterio que ya usaban
// adminGrupos.js y agrupacionProfesor.js.
//
// SIN OPCIONES A PROPÓSITO. Con `sensitivity: "base"`, "Alex" y "Álex"
// comparan IGUAL y su orden entre sí vuelve a depender de lo que devolviera
// la consulta — justo lo que se está arreglando. La colación por defecto los
// deja juntos y en un orden fijo.

export function compararNombres(a = "", b = "") {
  return String(a || "").localeCompare(String(b || ""), "es");
}

// Devuelve una COPIA ordenada; nunca ordena la lista recibida. Las franjas
// del cuadrante vienen de una sola petición y se reparten en muchas celdas
// —y en el panel de admin se vuelven a filtrar por profesor—, así que
// ordenar en el sitio cambiaría la lista que otro trozo de pantalla está
// leyendo.
export function ordenarPorNombre(lista = [], leerNombre = (item) => item?.nombre) {
  return [...(lista || [])].sort((a, b) => compararNombres(leerNombre(a), leerNombre(b)));
}
