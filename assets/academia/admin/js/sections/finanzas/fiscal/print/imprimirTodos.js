import { fetchConfig } from "../../../../api.js";
import { fetchModeloFiscal, fetchGastosTrimestre } from "../../../../apiFinanzas.js";
import { buildDocumentoHtml } from "./printDocumento.js";
import { buildAnexoGastosHtml, buildAnexoAlquilerHtml, buildAnexoNominasHtml } from "./anexosHtml.js";
import { prepararDatos130, prepararDatos202, prepararDatos115, prepararDatos111 } from "./datosImpresionModelo.js";
import { ensurePrintStylesLoaded } from "./printStylesLoader.js";

const TITULOS = { 130: "Modelo 130", 202: "Modelo 202", 115: "Modelo 115", 111: "Modelo 111" };
const PREPARADORES = { 130: prepararDatos130, 202: prepararDatos202, 115: prepararDatos115, 111: prepararDatos111 };
const DELAY_ENTRE_VENTANAS_MS = 800;
const FUENTE_HREF = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&display=swap";

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function construirAnexoHtml(modelo, preparados, { anio, trimestre, fetchGastosTrimestreFn }) {
  if (modelo === "130") return buildAnexoGastosHtml(await fetchGastosTrimestreFn({ anio, trimestre }));
  if (modelo === "115") return buildAnexoAlquilerHtml(preparados.anexoData);
  if (modelo === "111") return buildAnexoNominasHtml(preparados.anexoData);
  return "";
}

// Abre una ventana nueva con el documento ya maquetado para imprimir,
// llama a window.print() en ella y la cierra sola cuando el navegador
// avisa de que terminó (o tras un margen de seguridad si no avisa, p.ej.
// si el admin cancela el diálogo en algunos navegadores).
function imprimirEnVentanaNueva(documentoHtml, titulo) {
  const ventana = window.open("", "_blank", "width=900,height=1000");
  if (!ventana) return Promise.resolve();

  ensurePrintStylesLoaded(ventana.document);
  const fontLink = ventana.document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = FUENTE_HREF;
  ventana.document.head.appendChild(fontLink);
  ventana.document.title = titulo;
  ventana.document.body.innerHTML = `<div class="ac-fiscal-print-only" style="display:block">${documentoHtml}</div>`;

  return new Promise((resolve) => {
    const cerrar = () => { if (!ventana.closed) ventana.close(); resolve(); };
    ventana.addEventListener("afterprint", cerrar);
    setTimeout(cerrar, 5000);
    ventana.focus();
    ventana.print();
  });
}

async function imprimirUnModelo({ modelo, anio, trimestre, config, fetchModeloFiscalFn, fetchGastosTrimestreFn }) {
  const datosCrudos = await fetchModeloFiscalFn(modelo, { anio, trimestre });
  const preparados = PREPARADORES[modelo](datosCrudos);
  const anexoHtml = await construirAnexoHtml(modelo, preparados, { anio, trimestre, fetchGastosTrimestreFn });
  const titulo = `${TITULOS[modelo]} — T${trimestre} ${anio}`;

  const documentoHtml = buildDocumentoHtml({
    config,
    titulo,
    filas: preparados.filas,
    bannerLabel: `A ingresar · M${modelo} T${trimestre} ${anio}`,
    bannerTexto: `${preparados.resultado.toFixed(2)} €`,
    anexoHtml,
  });
  await imprimirEnVentanaNueva(documentoHtml, titulo);
}

// Descarga los 3 modelos del trimestre seleccionado como 3 PDFs
// independientes — una ventana por modelo, en secuencia (abrirlas todas
// de golpe con window.open suele bloquearlo el navegador como popup spam).
export async function imprimirTodosLosModelos({
  modelos,
  anio,
  trimestre,
  fetchConfigFn = fetchConfig,
  fetchModeloFiscalFn = fetchModeloFiscal,
  fetchGastosTrimestreFn = fetchGastosTrimestre,
}) {
  const config = await fetchConfigFn();
  for (const modelo of modelos) {
    await imprimirUnModelo({ modelo, anio, trimestre, config, fetchModeloFiscalFn, fetchGastosTrimestreFn });
    await esperar(DELAY_ENTRE_VENTANAS_MS);
  }
}
