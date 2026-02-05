export function ok(reply, data, requestId) {
  reply.header("x-request-id", requestId);
  return reply.code(200).send({ data, requestId });
}

export function created(reply, data, requestId) {
  reply.header("x-request-id", requestId);
  return reply.code(201).send({ data, requestId });
}

export function fail(reply, status, code, message, requestId, extra = {}) {
  reply.header("x-request-id", requestId);
  return reply.code(status).send({
    error: { code, message, ...extra },
    requestId,
  });
}
