import { callJson } from "./apiCore.js";
import { crearApiDeHojas } from "../../../shared/generador/apiDeHojas.js";

// El generador de hojas en el panel de la academia (sección "Ejercicios").
// Las llamadas son las compartidas (shared/generador/apiDeHojas.js) con el
// prefijo de la academia, que solo deja entrar al admin.
const api = crearApiDeHojas({ base: "/api/v1/academia/hojas-ejercicios", callJsonFn: callJson });

export const fetchCatalogoEjercicios = api.catalogo;
export const generarHojaEjercicios = api.generar;
export const generarActividadEjercicios = api.actividad;
export const interpretarPedidoEjercicios = api.interpretar;
export { pedirPdfDeLaHoja } from "../../../shared/generador/apiDeHojas.js";
