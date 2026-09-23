import { crearRutaDeInterpretar } from "./hojas/rutaDeInterpretar.js";
import { ROLES } from "./academia.hojas-ejercicios.routes.js";

// El pedido en palabras del generador, en el panel de la academia. La ruta
// está en hojas/rutaDeInterpretar.js.
export { SOURCE, InterpretarSchema, LIMITE_POR_MINUTO } from "./hojas/rutaDeInterpretar.js";

export default crearRutaDeInterpretar({ roles: ROLES });
