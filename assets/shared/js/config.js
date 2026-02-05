export function getApiBase() {
  return (window.__TTD_CONFIG__ && window.__TTD_CONFIG__.API_BASE_URL)
    ? window.__TTD_CONFIG__.API_BASE_URL
    : "https://tutordigital.onrender.com";
}
