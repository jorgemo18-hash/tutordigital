// El texto de la confirmación de "Eliminar definitivamente" un alumno.
//
// POR QUÉ ESTÁ EN SU PROPIO ARCHIVO. El mismo aviso sale desde dos sitios
// —la fila de la lista y el pie del drawer— y estaba escrito dos veces. Un
// texto duplicado que enumera consecuencias es un texto que se va a
// desincronizar: el día que cambie una regla de borrado, alguien actualizará
// uno de los dos.
//
// POR QUÉ ENUMERA. Decía solo "Esta acción no se puede deshacer", que es
// verdad pero no informa: el usuario no sabía que se lleva por delante todo
// el diario del alumno y sus informes. Lo comprobé contra las claves ajenas
// REALES de producción, no contra las migraciones (que pueden haberse
// aplicado a medias):
//
//   Se borra en cascada: horario, sesiones del diario, recuperaciones,
//   tarifas, pagos, informes, notas de examen, descuentos y la asignación
//   al profesor. Más la ficha escaneada, que borra el backend.
//
//   Se conserva: los recibos y las facturas ya emitidos — su línea se queda
//   sin alumno asociado (ON DELETE SET NULL) a propósito, porque son
//   documentos contables que hay que guardar seis años aunque el alumno ya
//   no esté.
//
// NO SE INVENTAN CIFRAS. Sería mejor decir "3 informes y 47 sesiones", pero
// el drawer no tiene esos recuentos y pedirlos es otra consulta; un número
// aproximado en un aviso de borrado es peor que ninguno.

export function mensajeEliminarAlumno(nombre) {
  return [
    `¿Eliminar definitivamente a ${nombre}?`,
    "",
    "Se borrará TODO su historial: el diario de clases, sus informes, sus notas de examen, sus pagos y su histórico de precios. También su ficha de inscripción escaneada.",
    "",
    "Los recibos y facturas ya emitidos se conservan, pero dejarán de estar asociados a su nombre.",
    "",
    "Esta acción no se puede deshacer.",
  ].join("\n");
}
