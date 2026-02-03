export function ok(res, data, requestId) {
  res.setHeader("x-request-id", requestId);
  return res.status(200).json({ data, requestId });
}

export function created(res, data, requestId) {
  res.setHeader("x-request-id", requestId);
  return res.status(201).json({ data, requestId });
}

export function fail(res, status, code, message, requestId, extra = {}) {
  res.setHeader("x-request-id", requestId);
  return res.status(status).json({
    error: { code, message, ...extra },
    requestId,
  });
}
