// session.routes.js — manifest: registra cada endpoint desde su propio
// módulo en ./session/ (se dividió lo que antes era este archivo, 427
// líneas, para que ninguno supere las 400). El guard se crea una vez aquí
// y se pasa explícito a cada registrador, en vez de que cada uno importe
// su propia instancia.
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { registerSessionStart } from "./session/start.routes.js";
import { registerSessionChoose } from "./session/choose.routes.js";
import { registerSessionMap } from "./session/map.routes.js";
import { registerSessionDetail } from "./session/detail.routes.js";
import { registerSessionBranch } from "./session/branch.routes.js";
import { registerSessionByTask } from "./session/by-task.routes.js";

export default async function sessionRoutes(app) {
  const guard = makeTenantMembershipGuard();

  registerSessionStart(app, { guard });
  registerSessionChoose(app, { guard });
  registerSessionMap(app, { guard });
  registerSessionDetail(app, { guard });
  registerSessionBranch(app, { guard });
  registerSessionByTask(app, { guard });
}
