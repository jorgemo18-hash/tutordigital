export function getApiBase() {
  const w = typeof window !== "undefined" ? window : null;
  if (!w) return process.env.TEST_API_BASE || "http://localhost:10000";
  return (w.__TTD_CONFIG__ && w.__TTD_CONFIG__.API_BASE_URL)
    ? w.__TTD_CONFIG__.API_BASE_URL
    : (w.location?.origin || "");
}
