// QUIÉNES TIENEN INFORME EN EL ENVÍO DE UNA FAMILIA.
//
// No son los mismos que los del recibo: el informe es del mes anterior (según
// el modo del centro) y lo reciben también los alumnos que se dieron de baja
// ese mes o después (30/09/2026, ver server/lib/academiaInformes/
// alumnosDeBaja.js). El servidor los manda en `alumnos_informe`; un listado
// de antes de ese cambio no lo trae, y entonces valen los del recibo.
//
// Un solo sitio para esta elección: si cada pantalla escogiera su lista, la
// pestaña Informe enseñaría a un alumno y el botón Enviar no lo mandaría.
export function alumnosDelInforme(item) {
  return item?.alumnos_informe || item?.alumnos_activos || [];
}

// "Eric · de baja": en la lista y en la tarjeta del informe, para que no
// parezca un error que un alumno archivado siga saliendo.
export function nombreConBaja(alumno) {
  return alumno?.de_baja ? `${alumno.nombre} · de baja` : alumno?.nombre || "";
}
