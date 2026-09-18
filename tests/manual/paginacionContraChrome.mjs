// ¿COINCIDE NUESTRA CUENTA DE FOLIOS CON LO QUE IMPRIME CHROME?
//
// ESTO NO ENTRA EN `npm test`, Y NO ES UN OLVIDO. Los tests normales corren
// sobre happy-dom, que no maqueta: todas las alturas valen 0, así que la
// medición no se puede probar ahí — solo la regla del reparto, que sí está
// cubierta en tests/hoja/paginacionDeLaHoja.test.mjs.
//
// Lo que este script comprueba es justo lo que allí no se puede: que
// `medirFolios` diga el mismo número de folios que saca la impresora. Y hay
// al menos una condición que SOLO se puede verificar aquí — que el alto de
// cada actividad incluya su margen inferior. Sin el margen, diez actividades
// se subestiman en dos centímetros, y ningún test de happy-dom lo nota porque
// allí el margen también es 0.
//
// Se ejecuta a mano, y de hecho encontró el fallo que motivó la simulación:
// con diez actividades la cuenta decía dos folios y Chrome imprimía tres.
//
// CÓMO SE EJECUTA (desde la raíz del repo):
//
//   1. cp assets/shared/hoja/vista-previa.html vp-tmp.html
//      y en vp-tmp.html cambiar el import de `muestras/enteros1eso.js` por
//      `muestras/_generada_tmp.js` y `HOJA_ENTEROS_1ESO` por `HOJA_GENERADA`.
//   2. python3 -m http.server 8099 &
//   3. node tests/manual/paginacionContraChrome.mjs
//   4. borrar vp-tmp.html y assets/shared/hoja/muestras/_generada_tmp.js
//
// Necesita Chromium y `pdfinfo` (poppler). La ruta del navegador se toma de
// PLAYWRIGHT_CHROMIUM, o /opt/pw-browsers/chromium por defecto.
//
// IMPORTANTE: el PDF se saca con `--print-to-pdf` de Chromium y NO con
// `page.pdf()` de Playwright. Playwright impone sus propios márgenes e
// ignora los de `@page`, así que mide una caja de página que no es la que
// sale por la impresora — con él esta comprobación salía verde y era mentira.

import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { crearAzar } from "../../server/lib/generadorEjercicios/aleatorio.js";
import { aActividadDeHoja } from "../../server/lib/generadorEjercicios/ejercicio.js";
import { conEjemploResuelto } from "../../server/lib/generadorEjercicios/ejemploResuelto.js";
import * as S from "../../server/lib/generadorEjercicios/generadores/sumaResta.js";
import * as P from "../../server/lib/generadorEjercicios/generadores/producto.js";
import * as Q from "../../server/lib/generadorEjercicios/generadores/potencias.js";
import * as C from "../../server/lib/generadorEjercicios/generadores/combinadas.js";
import { HOJA_ENTEROS_1ESO } from "../../assets/shared/hoja/muestras/enteros1eso.js";
import { MAX_ACTIVIDADES } from "../../assets/shared/hoja/js/actividades.js";

const NAVEGADOR = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium";
const URL_HOJA = process.env.URL_HOJA || "http://localhost:8099/vp-tmp.html";
const MUESTRA = "assets/shared/hoja/muestras/_generada_tmp.js";

// Doce baterías de tamaños distintos, para que el barrido pase por los dos
// bordes de folio.
const PLAN = [
  [P.multiplicaDosEnteros, 5], [P.divideDosEnteros, 5], [Q.potenciasDeBaseEntera, 5],
  [P.factorQueFalta, 4], [S.sumaMismoSigno, 5], [S.restaConParentesis, 5],
  [S.eliminaParentesis, 3], [C.combinadaDeUnNivel, 3], [P.cadenaProductosCocientes, 3],
  [C.combinadaConCorchetes, 3], [Q.paresConYSinParentesis, 4], [S.cadenaSumasRestas, 3],
];

const navegador = await chromium.launch({ executablePath: NAVEGADOR });
const pagina = await navegador.newPage();
let discrepancias = 0;

// El barrido no pasa de `MAX_ACTIVIDADES` porque la plantilla recorta ahí
// (ver actividades.js): más allá se pintarían las mismas y las filas de la
// tabla saldrían repetidas, que parece un fallo del barrido y no lo es.
const TOPE = Math.min(PLAN.length, MAX_ACTIVIDADES);

console.log("act  apart  dice  imprime  último(mm)  estado");
for (let n = 2; n <= TOPE; n += 1) {
  const azar = crearAzar(`MEDIDA-${n}`);
  const ejercicios = PLAN.slice(0, n).map(([g, c]) => conEjemploResuelto(g, azar, { cuantos: c }));
  writeFileSync(MUESTRA, `export const HOJA_GENERADA = ${JSON.stringify({
    ...HOJA_ENTEROS_1ESO,
    ejemplos: [],
    actividades: ejercicios.map(aActividadDeHoja),
  }, null, 2)};\n`);

  await pagina.goto(URL_HOJA, { waitUntil: "networkidle" });
  await pagina.waitForTimeout(600);
  const medida = await pagina.evaluate(async () => {
    const mod = await import(`/assets/shared/hoja/js/ajusteDelFolio.js?v=${Date.now()}`);
    return mod.medirFolios(document.querySelector(".hoja"));
  });

  const pdf = `/tmp/paginacion-${n}.pdf`;
  execSync(`timeout 60 ${NAVEGADOR} --headless --disable-gpu --no-sandbox `
    + `--no-pdf-header-footer --run-all-compositor-stages-before-draw `
    + `--virtual-time-budget=5000 --print-to-pdf=${pdf} ${URL_HOJA}`, { stdio: "pipe" });
  const impresos = Number(execSync(`pdfinfo ${pdf} | awk '/^Pages/{print $2}'`).toString().trim());

  // Dentro del margen de duda una diferencia de un folio es el
  // comportamiento declarado, no un fallo.
  const cuadra = medida.folios === impresos
    || (medida.enElLimite && Math.abs(medida.folios - impresos) <= 1);
  if (!cuadra) discrepancias += 1;

  const apartados = ejercicios.reduce((t, e) => t + e.apartados.length, 0);
  const estado = medida.enElLimite ? "en el límite"
    : medida.desaprovechado ? "folio gastado" : "bien";
  console.log(
    String(n).padStart(3) + String(apartados).padStart(7) + String(medida.folios).padStart(6)
    + String(impresos).padStart(9) + String(medida.usadoUltimoMm).padStart(12)
    + "  " + estado + (cuadra ? "" : "   ← NO CUADRA"),
  );
}

await navegador.close();
console.log(discrepancias
  ? `\n${discrepancias} discrepancias con la impresora`
  : "\nla cuenta coincide con lo que imprime Chrome en todos los tamaños");
process.exit(discrepancias ? 1 : 0);
