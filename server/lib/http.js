import { Sentry } from "./sentry.js";

export function ok(reply, data, requestId) {
  const rid = requestId || reply.request?.requestId || reply.requestId || null;
  if (rid) reply.header("x-request-id", rid);
  return reply.code(200).send({ data, requestId: rid });
}

export function created(reply, data, requestId) {
  const rid = requestId || reply.request?.requestId || reply.requestId || null;
  if (rid) reply.header("x-request-id", rid);
  return reply.code(201).send({ data, requestId: rid });
}

// cause: el error subyacente (p.ej. de Supabase) que motivó este fail() — se
// adjunta solo al evento de Sentry, nunca a la respuesta HTTP (extra sí se
// manda al cliente, ver abajo). Sin esto, un 5xx de "intermitencia" solo
// deja "Membership lookup failed" en Sentry, sin el error real de Postgres
// que permitiría diferenciar una intermitencia de red de un bug determinista.
export function fail(reply, status, code, message, requestId, extra = {}, cause) {
  const rid = requestId || reply.request?.requestId || reply.requestId || null;
  if (rid) reply.header("x-request-id", rid);
  // Los handlers casi siempre capturan sus propios errores y responden con
  // fail() en vez de dejarlos escapar — el hook onError de Fastify (donde
  // vive el único Sentry.captureException del proyecto, ver app.js) nunca
  // se dispara para esos casos, así que un 5xx "manejado" no generaba
  // ningún evento en Sentry pese a ser un fallo real de producción.
  if (status >= 500) {
    Sentry.captureMessage(message, {
      level: "error",
      extra: {
        code,
        requestId: rid,
        ...(cause && {
          causeMessage: cause.message || String(cause),
          causeCode:    cause.code,
          causeDetails: cause.details,
          causeHint:    cause.hint,
        }),
      },
    });
  }
  return reply.code(status).send({
    error: { code, message, ...extra },
    requestId: rid,
  });
}
