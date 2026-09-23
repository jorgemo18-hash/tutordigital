// EL PDF DE LA HOJA, DE VERDAD: con Chromium y la página del panel.
//
// Lo que no puede probar `npm test` (no hay Chromium ni servidor): que el
// PDF sale con tantas páginas como folios calcula la hoja y con el pie en
// todas. Hace lo mismo que la función de Vercel (api/hoja-pdf.js) con el
// Chromium de la máquina.
//
//   python3 -m http.server 8099 &
//   CHROMIUM_PATH=/opt/pw-browsers/chromium node tests/manual/imprimePdfDelPanel.mjs
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { lanzaNavegador } from "../../server/lib/hojaPdf/lanzaNavegador.js";
import { imprimeHojaEnPdf } from "../../server/lib/hojaPdf/imprimeHojaEnPdf.js";
import { hojaDelPanel } from "../../server/lib/generadorEjercicios/hojaDelPanel.js";
import { TEMAS_CON_GENERADOR } from "../../server/lib/generadorEjercicios/temasConGenerador.js";

const URL_PAGINA = process.env.URL_PAGINA || "http://localhost:8099/assets/shared/hoja/hoja-imprimible.html";
const CASOS = [[1, "normal", 6], [1, "refuerzo", null], [3, "refuerzo", null], [5, "refuerzo", 8], [6, "normal", null]];

const navegador = await lanzaNavegador();
let mal = 0;
try {
  for (const [objetivo, intensidad, actividades] of CASOS) {
    const { hoja } = hojaDelPanel({ temaId: TEMAS_CON_GENERADOR[0].id, objetivo, intensidad, actividades, semilla: "manual" });
    const { pdf, folios } = await imprimeHojaEnPdf({ navegador, urlPagina: URL_PAGINA, hoja: { ...hoja, centro: "Lyceo" } });
    const ruta = `/tmp/hoja-pdf-${objetivo}-${intensidad}.pdf`;
    writeFileSync(ruta, pdf);
    const paginas = Number(execSync(`pdfinfo ${ruta} | awk '/^Pages/{print $2}'`).toString().trim());
    const pies = Number(execSync(`pdftotext ${ruta} - | grep -c "TutorDigital · Lyceo" || true`).toString().trim());
    const bien = paginas === folios && pies === paginas;
    if (!bien) mal += 1;
    console.log(`objetivo ${objetivo} ${intensidad.padEnd(8)} ${folios} folios → ${paginas} páginas, ${pies} pies ${bien ? "" : "  ← MAL"}`);
  }
} finally {
  await navegador.close();
}
console.log(mal ? `${mal} PDFs no cuadran` : "todos los PDFs tienen una página por folio y un pie en cada una");
process.exit(mal ? 1 : 0);
