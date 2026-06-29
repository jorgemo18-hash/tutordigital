// Banner "A ingresar" de cada modelo — fondo cobre sólido, texto blanco,
// importe grande a la derecha. Distinto de bannerInfo.js (aviso legal,
// ámbar suave, sin tocar) — este es el resultado, no una nota.
export function buildBannerResultado(etiqueta, importeTexto) {
  const banner = document.createElement("div");
  banner.className = "ac-fiscal-banner-resultado";

  const lbl = document.createElement("span");
  lbl.className = "ac-fiscal-banner-resultado-label";
  lbl.textContent = etiqueta;

  const val = document.createElement("span");
  val.className = "ac-fiscal-banner-resultado-valor";
  val.textContent = importeTexto;

  banner.append(lbl, val);
  return { banner, val };
}
