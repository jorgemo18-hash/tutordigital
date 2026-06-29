// Banner informativo (aviso legal + banners de "A ingresar" de cada
// modelo) — mismo .ac-banner.amber que ya usan alumnosList.js/
// ocrStatusBanner.js, pero sin el cursor:pointer porque aquí no es
// clicable.
export function buildBannerInfo(texto) {
  const banner = document.createElement("div");
  banner.className = "ac-banner amber";
  banner.style.cursor = "default";
  banner.textContent = texto;
  return banner;
}
