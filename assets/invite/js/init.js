// Punto de entrada — orquesta los módulos de invite.html. Reemplaza el
// <script type="module"> inline que antes tenía toda la lógica en un único
// closure. Comportamiento idéntico al original, solo reorganizado.
import { el, showMessage, showResult, showRedirectBar } from "./dom.js";
import { createAuthModeController } from "./authModeController.js";
import { parseInviteParams, consumeSessionFromUrl } from "./urlParams.js";
import { exchangePkceCode } from "./pkceExchange.js";
import { showTenantBadge, activateInviteFlow } from "./uiFlows.js";

const params = parseInviteParams();
const modeController = createAuthModeController();
const ui = { el, showMessage, showResult, showRedirectBar, ...modeController };

showTenantBadge(params, ui);

(async function init() {
  if (params.prefillEmail) {
    el("email").value = params.prefillEmail;
  }

  // Flujo PKCE: Supabase redirige con ?code= en lugar de #access_token=.
  // Canjeamos el código server-side antes de consumeSessionFromUrl.
  const pkceConsumed = await exchangePkceCode(params);
  const { consumed: implicitConsumed } = consumeSessionFromUrl();
  const consumed = pkceConsumed || implicitConsumed;

  await activateInviteFlow(params, ui, consumed);
})();
