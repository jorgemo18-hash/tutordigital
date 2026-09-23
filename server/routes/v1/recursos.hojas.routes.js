import { crearRutasDeHojas } from "./hojas/rutasDeHojas.js";
import { crearRutaDeInterpretar } from "./hojas/rutaDeInterpretar.js";

// El generador de hojas en RECURSOS del panel del profesor de instituto
// (diseño de Claude Design, 23/9). Las mismas rutas que la academia
// (hojas/rutasDeHojas.js); aquí entran el profesor y el admin del centro.
export const ROLES = ["teacher", "admin"];

export default async function recursosHojasRoutes(app) {
  await app.register(crearRutasDeHojas({ roles: ROLES }));
  await app.register(crearRutaDeInterpretar({ roles: ROLES }));
}
