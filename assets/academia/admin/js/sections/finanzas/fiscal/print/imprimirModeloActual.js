import { fetchConfig } from "../../../../api.js";
import { buildCabeceraConCasillasHtml, extraerFilaImpresion } from "./printDocumento.js";
import { ensurePrintStylesLoaded } from "./printStylesLoader.js";

const ID_CABECERA = "ac-fiscal-print-cabecera";
const ID_ANEXO = "ac-fiscal-print-anexo";

// Imprime el modelo que se ve ahora en pantalla — lee los valores
// actuales de sus filas (incluidos los overrides) directamente del DOM
// en vivo en vez de volver a pedírselos al backend, así el PDF coincide
// exactamente con lo que el admin está viendo aunque todavía no lo haya
// guardado. La barra "A ingresar" no se duplica: ya está en la página
// (banner) y _fiscal-print.css se encarga de mostrarla sin su fondo
// cobre al imprimir — el anexo se inserta justo después de ella.
export async function imprimirModeloActual({ container, formCard, banner, titulo, anexoHtml, fetchConfigFn = fetchConfig }) {
  ensurePrintStylesLoaded();
  const config = await fetchConfigFn();

  const filas = Array.from(formCard.querySelectorAll(".ac-fiscal-casilla-row")).map(extraerFilaImpresion);

  document.getElementById(ID_CABECERA)?.remove();
  const cabecera = document.createElement("div");
  cabecera.id = ID_CABECERA;
  cabecera.className = "ac-fiscal-print-only";
  cabecera.innerHTML = buildCabeceraConCasillasHtml({ config, titulo, filas });
  container.insertBefore(cabecera, formCard);

  document.getElementById(ID_ANEXO)?.remove();
  const anexo = document.createElement("div");
  anexo.id = ID_ANEXO;
  anexo.className = "ac-fiscal-print-only";
  anexo.innerHTML = anexoHtml;
  banner.insertAdjacentElement("afterend", anexo);

  window.print();
}
