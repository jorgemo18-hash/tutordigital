import { crearRutasDeHojas } from "./hojas/rutasDeHojas.js";
import { crearRutaDeInterpretar } from "./hojas/rutaDeInterpretar.js";
import { crearRutasDeHojasGuardadas } from "./hojas/rutasDeHojasGuardadas.js";

// El generador de hojas en RECURSOS del panel del profesor de instituto
// (diseño de Claude Design, 23/9). Las mismas rutas que la academia
// (hojas/rutasDeHojas.js); aquí entran el profesor y el admin del centro.
export const ROLES = ["teacher", "admin"];

export default async function recursosHojasRoutes(app) {
  await app.register(crearRutasDeHojas({ roles: ROLES }));
  await app.register(crearRutaDeInterpretar({ roles: ROLES }));
  // Guardar con código y volver a abrir (paso 2). De momento solo en
  // Recursos: la sección de la academia sigue imprimiendo sin código.
  await app.register(crearRutasDeHojasGuardadas({ roles: ROLES }));
}
