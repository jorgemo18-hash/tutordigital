export function json(res, status, data, requestId = null) {
  if (requestId) res.setHeader("x-request-id", requestId);
  return res.status(status).json(data);
}

export function error(res, status, message, code, requestId = null, extra = {}) {
  return json(
    res,
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
