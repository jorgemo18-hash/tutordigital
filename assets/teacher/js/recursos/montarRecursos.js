import { createPantallaDeHojas } from "./pantallaDeHojas.js";
import { EVENTO_ASIGNATURA } from "../features/eventoDeAsignatura.js";

// RECURSOS SE MONTA LA PRIMERA VEZ QUE SE ABRE, no al cargar el panel: el
// catálogo del generador y la primera hoja son peticiones que la mayoría de
// visitas al panel (pasar lista, poner notas) no necesitan.
//
// Hoy Recursos es solo "Hojas de ejercicios" y se abre directamente en ella
// (el diseño: una pestaña con una sola entrada es ruido). Cuando haya
// Programación y Guiones, aquí irá la lista de recursos.
//
// `getAsignatura`: la que tiene elegida el profesor; si cambia, la pantalla
// lo revisa (ver avisoDeAsignatura.js).
export function crearMontajeDeRecursos({
  raiz, centro = "", getAsignatura = () => "", crearPantallaFn = createPantallaDeHojas, doc = globalThis.document,
}) {
  let pantalla = null;
  doc?.addEventListener?.(EVENTO_ASIGNATURA, () => pantalla?.revisarAsignatura?.());
  return function alMostrar() {
    if (pantalla || !raiz) return;
    pantalla = crearPantallaFn({ centro, getAsignatura });
    pantalla.render(raiz);
  };
}
