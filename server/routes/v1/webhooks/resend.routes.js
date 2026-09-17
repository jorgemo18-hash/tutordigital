import { makeRequestId } from "../../../lib/requestId.js";
import { createSupabaseAdmin } from "../../../lib/supabase.js";
import { verificarWebhookResend } from "../../../lib/academiaEmailEventos/verificarWebhook.js";
import { aplicarEventoResend } from "../../../lib/academiaEmailEventos/aplicarEvento.js";

// POST /api/v1/webhooks/resend — avisos de Resend sobre los emails que
// mandamos: entregado, rebotado, queja, fallido (ver migración 122).
//
// TRES COSAS QUE HACEN ESTA RUTA DISTINTA A TODAS LAS DEMÁS:
//
// 1. NO LLEVA SESIÓN. La llama Resend desde sus servidores, no un
//    navegador. Lo que la protege no es un token: es la FIRMA del cuerpo
//    (RESEND_WEBHOOK_SECRET). Sin firma válida, 401 y no se escribe nada.
//
// 2. NECESITA EL CUERPO CRUDO. La firma se calcula sobre el texto exacto
//    que llegó; si Fastify lo parsea a objeto y luego lo volvemos a
//    serializar, cualquier diferencia de orden o de espacios invalida la
//    firma. De ahí el `addContentTypeParser` de abajo — y de ahí que este
//    fichero se registre como plugin propio, para que ese parser NO afecte
//    al resto de la API.
//
// 3. CONTESTA 200 CASI SIEMPRE. Un error nuestro (5xx) hace que Resend
//    reintente el mismo evento una y otra vez. Si la firma es válida, el
//    evento ya es nuestro problema: se contesta 200 y lo que falle se
//    queda en el log. El único no-2xx es la firma inválida (401), que es
//    justo lo que Resend NO debe reintentar.
export default async function resendWebhookRoutes(app, {
  crearAdminFn = createSupabaseAdmin,
  aplicarEventoFn = aplicarEventoResend,
} = {}) {
  // Parser encapsulado en este plugin: deja el cuerpo como texto. Se
  // guarda en `req.rawBody` y el `body` se queda también como string — no
  // se parsea aquí a propósito, porque el objeto de verdad lo devuelve la
  // verificación de la firma y no queremos dos versiones del mismo dato
  // circulando (una parseada sin verificar y otra verificada).
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    req.rawBody = typeof body === "string" ? body : String(body || "");
    done(null, req.rawBody);
  });

  app.post("/resend", async (req, reply) => {
    const requestId = req.requestId || makeRequestId();

    const verificado = verificarWebhookResend({
      cuerpoCrudo: req.rawBody,
      headers: req.headers,
      secreto: process.env.RESEND_WEBHOOK_SECRET,
    });

    if (!verificado.ok) {
      // El secreto sin configurar es un fallo NUESTRO de despliegue, no un
      // intento de colarse, y conviene que se distinga en el log: si no,
      // nadie entiende por qué "los rebotes no llegan".
      const nivel = verificado.motivo === "webhook_secret_no_configurado" ? "error" : "warn";
      req.log[nivel]({ requestId, motivo: verificado.motivo }, "webhook de resend rechazado");
      return reply.code(401).send({ ok: false });
    }

    // TODO lo que va después de la firma va dentro del try, incluida la
    // creación del cliente de Supabase. Sin esto, un despliegue sin
    // SUPABASE_SERVICE_ROLE_KEY hacía que la ruta lanzara y devolviera 500,
    // y un 500 es justo lo que provoca que Resend reintente el mismo evento
    // sin parar y acabe desactivando el webhook. Con firma válida, el
    // evento ya es nuestro problema: se acusa recibo y se registra el fallo.
    let resultado;
    try {
      resultado = await aplicarEventoFn(crearAdminFn(), {
        evento: verificado.evento,
        svixId: verificado.svixId,
      });
    } catch (err) {
      req.log.error({ requestId, err, tipo: verificado.evento?.type }, "webhook de resend: excepción al aplicar el evento");
      return reply.code(200).send({ ok: false, motivo: "excepcion" });
    }

    if (!resultado?.ok) {
      // 200 a pesar del fallo, a propósito (punto 3 de arriba): reintentar
      // no va a arreglar un error de escritura nuestro, y mientras
      // reintenta, Resend acaba desactivando el webhook.
      req.log.error(
        { requestId, motivo: resultado?.motivo, err: resultado?.error, tipo: verificado.evento?.type },
        "evento de resend no aplicado"
      );
      return reply.code(200).send({ ok: false, motivo: resultado?.motivo || "desconocido" });
    }

    // Se registra en el log SOLO lo que dice que un email no llegó. Los
    // 'delivered' son la mayoría del tráfico y no aportan nada al log.
    if (resultado.estado && resultado.estado !== "entregado") {
      req.log.warn(
        { requestId, estado: resultado.estado, envioId: resultado.envioId, tipo: verificado.evento.type },
        "un email a una familia no llegó"
      );
    }

    return reply.code(200).send({ ok: true, duplicado: Boolean(resultado.duplicado) });
  });
}
