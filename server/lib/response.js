export function json(reply, status, data, requestId = null) {
  if (requestId) reply.header("x-request-id", requestId);
  return reply.code(status).send(data);
}

export function error(reply, status, message, code, requestId = null, extra = {}) {
  return json(
    reply,
    status,
    {
      error: message,
      code,
      status,
      request_id: requestId,
      ...extra,
    },
    requestId
  );
}
