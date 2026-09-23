import { crearRutasDeHojas } from "./hojas/rutasDeHojas.js";

// El generador de hojas en el panel de la ACADEMIA (sección "Ejercicios").
// Jorge, el 23/9: *"ponlo también en academias, que es un servicio más...
// lo usen o no"*. Las rutas están en hojas/rutasDeHojas.js; aquí solo se
// dice quién entra: el admin del centro, que es quien usa ese panel.
export const ROLES = ["admin"];
export { GenerarSchema, ActividadSchema, Base } from "./hojas/rutasDeHojas.js";

export default crearRutasDeHojas({ roles: ROLES });
