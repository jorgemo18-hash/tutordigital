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

export function fail(reply, status, code, message, requestId, extra = {}) {
  const rid = requestId || reply.request?.requestId || reply.requestId || null;
  if (rid) reply.header("x-request-id", rid);
  return reply.code(status).send({
    error: { code, message, ...extra },
    requestId: rid,
  });
}
