import adminTeachersInviteRoutes from "./admin-teachers/invite.routes.js";
import adminTeachersListadoRoutes from "./admin-teachers/listado.routes.js";
import adminTeachersPatchRoutes from "./admin-teachers/patch.routes.js";
import adminTeachersRevokeRoutes from "./admin-teachers/revoke.routes.js";
import adminTeachersDeleteRoutes from "./admin-teachers/delete.routes.js";

// Composition root: el archivo original (553 líneas, un handler por ruta)
// se partió en server/routes/v1/admin-teachers/ por el límite de 400
// líneas de este repo. Cada submódulo registra su propia ruta con
// app.post/app.get directamente (no son plugins con prefix propio), así
// que aquí basta con invocarlos todos sobre el mismo `app`.
export default async function adminTeachersRoutes(app) {
  await adminTeachersInviteRoutes(app);
  await adminTeachersListadoRoutes(app);
  await adminTeachersPatchRoutes(app);
  await adminTeachersRevokeRoutes(app);
  await adminTeachersDeleteRoutes(app);
}
