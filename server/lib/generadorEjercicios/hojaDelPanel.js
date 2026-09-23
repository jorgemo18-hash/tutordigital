import { randomBytes } from "node:crypto";
import { crearAzar } from "./aleatorio.js";
import { montaHoja, INTENSIDADES } from "./montadorDeHoja.js";
import { OBJETIVOS, TITULO_DE_OBJETIVO } from "./catalogoDeBaterias.js";

// LA HOJA TAL COMO LA PIDE EL PANEL DE LA ACADEMIA (sección "Ejercicios").
//
// Separado de la ruta para poder probarlo sin servidor: qué se ofrece, qué
// cabecera lleva y, sobre todo, que LA MISMA SEMILLA DA LA MISMA HOJA, que es
// lo único que permite volver a imprimir una hoja ya repartida.
//
// Hoy el catálogo es solo 1.º ESO, números enteros. La cabecera lo dice tal
// cual en vez de dejar que el centro lo elija, porque no hay nada más que
// elegir todavía.
export const CABECERA = { materia: "Matemáticas", curso: "1.º ESO", tema: "Números enteros" };

export function catalogoDelPanel() {
  return {
    ...CABECERA,
    objetivos: OBJETIVOS.map((numero) => ({ numero, titulo: TITULO_DE_OBJETIVO[numero] })),
    intensidades: Object.keys(INTENSIDADES),
  };
}

export function semillaNueva() {
  return randomBytes(6).toString("hex");
}

export function hojaDelPanel({ objetivo, intensidad, semilla }) {
  const { hoja } = montaHoja({
    objetivo,
    intensidad,
    azar: crearAzar(`${objetivo}-${intensidad}-${semilla}`),
    cabecera: { ...CABECERA, objetivo: TITULO_DE_OBJETIVO[objetivo] },
  });
  return hoja;
}
