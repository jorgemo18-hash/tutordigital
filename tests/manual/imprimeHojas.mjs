// IMPRIME HOJAS MONTADAS A PDF, PARA MIRARLAS.
//
// ESTO NO ENTRA EN `npm test`, y no es un olvido: no comprueba nada, produce
// un PDF. Existe porque la única forma honesta de revisar una hoja de
// ejercicios es verla como la va a ver el alumno, en papel, y porque casi
// todos los fallos de este generador se han encontrado mirando la hoja
// impresa y no leyendo el código (el `18 : ___ = 9` que escondía el único
// negativo, el `(-2)^4` al lado de `2^4`, el paréntesis que valía 0...).
//
// Saca el PDF con `--print-to-pdf` de Chromium y NO con `page.pdf()` de
// Playwright, por el mismo motivo que `paginacionContraChrome.mjs`: Playwright
// impone sus propios márgenes e ignora los de `@page`, así que imprime una
// caja de página que no es la que sale por la impresora.
//
// CÓMO SE EJECUTA (desde la raíz del repo):
//
//   python3 -m http.server 8099 >/dev/null 2>&1 &
//   node tests/manual/imprimeHojas.mjs 3:normal 3:refuerzo 6:refuerzo
//   kill %1
//
// Cada argumento es `objetivo:intensidad` y, opcionalmente, `:semilla`.
// Sin argumentos saca los cuatro objetivos en las tres intensidades.
// El PDF sale en `/tmp/hojas.pdf` (o en $SALIDA).
//
// Necesita Chromium (PLAYWRIGHT_CHROMIUM o /opt/pw-browsers/chromium) y
// `pdfunite` (poppler).

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { crearAzar } from "../../server/lib/generadorEjercicios/aleatorio.js";
import { montaHoja } from "../../server/lib/generadorEjercicios/montadorDeHoja.js";
import { OBJETIVOS, BATERIAS_POR_OBJETIVO } from "../../server/lib/generadorEjercicios/catalogoDeBaterias.js";

const NAVEGADOR = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium";
const PUERTO = process.env.PUERTO || 8099;
const SALIDA = process.env.SALIDA || "/tmp/hojas.pdf";
const MUESTRA = "assets/shared/hoja/muestras/_generada_tmp.js";
const PAGINA = "vp-tmp.html";

// El título que se imprime arriba de cada hoja. Sale del catálogo, no de aquí:
// una hoja que se titula lo que yo escriba en un script no es la hoja real.
const CABECERA = {
  materia: "Matemáticas",
  curso: "1.º ESO",
  centro: "Lyceo",
};

const conBaterias = OBJETIVOS.filter((o) => BATERIAS_POR_OBJETIVO[o].length > 0);
const peticiones = (process.argv.slice(2).length
  ? process.argv.slice(2).map((a) => {
    const [objetivo, intensidad = "normal", semilla = "muestra"] = a.split(":");
    return { objetivo: Number(objetivo), intensidad, semilla };
  })
  : conBaterias.flatMap((objetivo) => ["repaso", "normal", "refuerzo"].map(
    (intensidad) => ({ objetivo, intensidad, semilla: "muestra" }),
  )));

// La plantilla de vista previa apunta a la muestra fija del repositorio; para
// pintar una hoja montada hace falta una copia que importe la temporal. Se
// genera y se borra aquí para no dejar un archivo que alguien commitee.
const paginaTemporal = readFileSync("assets/shared/hoja/vista-previa.html", "utf8")
  .replace("/assets/shared/hoja/muestras/enteros1eso.js", `/${MUESTRA}`)
  .replace(/HOJA_ENTEROS_1ESO/g, "HOJA_GENERADA");
writeFileSync(PAGINA, paginaTemporal);

const pdfs = [];
try {
  peticiones.forEach(({ objetivo, intensidad, semilla }, i) => {
    const { hoja, soluciones } = montaHoja({
      objetivo,
      intensidad,
      azar: crearAzar(`${objetivo}-${intensidad}-${semilla}`),
      cabecera: { ...CABECERA, objetivo: `Objetivo ${objetivo} · ${intensidad}` },
    });
    writeFileSync(MUESTRA, `export const HOJA_GENERADA = ${JSON.stringify(hoja, null, 2)};\n`);

    const pdf = `/tmp/hoja-${i}-${objetivo}-${intensidad}.pdf`;
    execSync(`timeout 60 ${NAVEGADOR} --headless --disable-gpu --no-sandbox `
      + `--no-pdf-header-footer --run-all-compositor-stages-before-draw `
      + `--virtual-time-budget=6000 --print-to-pdf=${pdf} `
      + `http://localhost:${PUERTO}/${PAGINA}`, { stdio: "pipe" });
    const folios = Number(execSync(`pdfinfo ${pdf} | awk '/^Pages/{print $2}'`).toString().trim());
    pdfs.push(pdf);

    const apartados = hoja.actividades.reduce((n, a) => n + a.apartados.length, 0);
    const repaso = soluciones.filter((s) => s.esRepaso).length;
    console.log(
      `objetivo ${objetivo} ${intensidad.padEnd(8)} `
      + `${String(hoja.actividades.length).padStart(2)} act (${repaso} repaso)  `
      + `${String(apartados).padStart(3)} apartados  ${folios} folio(s)`,
    );
  });

  execSync(`pdfunite ${pdfs.join(" ")} ${SALIDA}`);
  console.log(`\n${SALIDA} — ${peticiones.length} hojas`);
} finally {
  pdfs.forEach((p) => { try { unlinkSync(p); } catch { /* ya no está */ } });
  try { unlinkSync(MUESTRA); } catch { /* ya no está */ }
  try { unlinkSync(PAGINA); } catch { /* ya no está */ }
}
