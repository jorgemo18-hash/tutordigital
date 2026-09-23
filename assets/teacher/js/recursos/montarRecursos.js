import { createPantallaDeHojas } from "./pantallaDeHojas.js";

// RECURSOS SE MONTA LA PRIMERA VEZ QUE SE ABRE, no al cargar el panel: el
// catálogo del generador y la primera hoja son peticiones que la mayoría de
// visitas al panel (pasar lista, poner notas) no necesitan.
//
// Hoy Recursos es solo "Hojas de ejercicios" y se abre directamente en ella
// (el diseño: una pestaña con una sola entrada es ruido). Cuando haya
// Programación y Guiones, aquí irá la lista de recursos.
export function crearMontajeDeRecursos({ raiz, centro = "", crearPantallaFn = createPantallaDeHojas }) {
  let montado = false;
  return function alMostrar() {
    if (montado || !raiz) return;
    montado = true;
    crearPantallaFn({ centro }).render(raiz);
  };
}
