import { escHtml } from "../../../assets/shared/js/escHtml.js";

// LA PROGRAMACIÓN EN PDF, HECHA SIEMPRE CON EL MISMO MOTOR.
//
// Jorge, 24/9: la programación impresa desde Safari salía con 9 páginas o
// con 7 según tuviera marcado "Imprimir cabeceras y pies de página", y con
// la dirección de la web arriba. El truco de la tabla con cabecera y pie
// que se repiten ayudaba en Chrome pero no mandaba en Safari. Aquí la hace
// un Chromium sin pantalla (el mismo que imprime las hojas, ver
// hojaPdf/lanzaNavegador.js), y la cabecera y el pie los pone el propio
// motor en cada página, con "página N de M".
export const TIEMPO_MAXIMO_MS = 20000;


// Las plantillas de cabecera y pie de Chromium no heredan el CSS de la
// página: llevan su propio estilo, y el tamaño de letra hay que ponerlo
// (por defecto sale diminuto).
const ESTILO = "font: 7.5pt 'IBM Plex Sans', system-ui, sans-serif; color: #777; width: 100%; margin: 0 16mm; display: flex; justify-content: space-between;";

export function plantillas({ arriba = "", abajo = "" } = {}) {
  return {
    headerTemplate: `<div style="${ESTILO} border-bottom: 0.5pt solid #ccc; padding-bottom: 2mm;"><span>${escHtml(arriba)}</span></div>`,
    footerTemplate: `<div style="${ESTILO} border-top: 0.5pt solid #ccc; padding-top: 2mm;"><span>${escHtml(abajo)}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
  };
}

export async function imprimeProgramacionEnPdf({ navegador, urlPagina, contenido, lineas }) {
  const pagina = await navegador.newPage();
  try {
    await pagina.goto(urlPagina, { waitUntil: "load", timeout: TIEMPO_MAXIMO_MS });
    await pagina.waitForFunction(() => window.programacionLista === true, { timeout: TIEMPO_MAXIMO_MS });
    await pagina.evaluate((c) => window.pintarProgramacionImprimible(c), contenido);
    const pdf = await pagina.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: "22mm", bottom: "20mm", left: "16mm", right: "16mm" },
      ...plantillas(lineas),
    });
    return { pdf: Buffer.from(pdf) };
  } finally {
    await pagina.close().catch(() => {});
  }
}

// Lo que va arriba y abajo de cada página: qué documento es y de qué centro.
export function lineasDeLaProgramacion({ curriculo, cabecera, centro }) {
  return {
    arriba: ["Programación didáctica", curriculo?.materia, cabecera?.curso ? `${cabecera.curso}.º ESO` : ""].filter(Boolean).join(" · "),
    abajo: centro || "",
  };
}
