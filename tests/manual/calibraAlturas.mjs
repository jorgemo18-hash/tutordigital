// CUÁNTO MIDE CADA BATERÍA EN EL FOLIO.
//
// POR QUÉ HACE FALTA ESTO. El montador corre en Node y ahí no hay maquetación:
// no puede saber cuánto ocupa una actividad. Decidía por NÚMERO de
// actividades, y eso se vio mal en el papel dos veces — una hoja de refuerzo
// del objetivo 3 dejaba 35 mm en blanco y otra del objetivo 6 sacaba un
// segundo folio con solo el pie.
//
// Así que se mide una vez, con el navegador de verdad, y el montador suma
// milímetros medidos en vez de contar actividades. La tabla que sale de aquí
// es un DATO CON FECHA, no una constante: si cambia el CSS de la hoja o el
// tamaño de letra, hay que volver a pasar esto.
//
// LO QUE SE GUARDA ES EL MÁXIMO DE VARIAS SEMILLAS, no la media. Una batería
// no mide siempre lo mismo: la explicación del ejemplo resuelto es más larga
// unas veces que otras. Con la media, la mitad de las hojas se pasarían de
// folio; con el máximo, a veces sobra un poco de blanco. Sobrar blanco es un
// defecto; salirse de folio es una hoja mal montada.
//
// CÓMO SE EJECUTA (desde la raíz del repo):
//
//   python3 -m http.server 8099 >/dev/null 2>&1 &
//   node tests/manual/calibraAlturas.mjs
//   kill %1
//
// Reescribe `server/lib/generadorEjercicios/alturasMedidas.js`. Después hay
// que pasar `paginacionContraChrome.mjs` para comprobar que la cuenta sigue
// coincidiendo con lo que imprime Chrome.

import { chromium } from "playwright";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { crearAzar } from "../../server/lib/generadorEjercicios/aleatorio.js";
import { conEjemploResuelto } from "../../server/lib/generadorEjercicios/ejemploResuelto.js";
import { aActividadDeHoja } from "../../server/lib/generadorEjercicios/ejercicio.js";
import { todasLasBaterias } from "../../server/lib/generadorEjercicios/catalogoDeBaterias.js";
import { TEMAS_CON_GENERADOR } from "../../server/lib/generadorEjercicios/temasConGenerador.js";
import { MODOS_DE_APARTADOS, apartadosDe } from "../../server/lib/generadorEjercicios/apartadosDeLaBateria.js";
import { HOJA_ENTEROS_1ESO } from "../../assets/shared/hoja/muestras/enteros1eso.js";

const NAVEGADOR = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium";
const PUERTO = process.env.PUERTO || 8099;
const DESTINO = "server/lib/generadorEjercicios/alturasMedidas.js";

// OCHO SEMILLAS, Y NO TRES COMO PUSE AL PRINCIPIO. Con tres, los números
// salían NO MONÓTONOS: varias baterías medían más en `medio` que en `maximo`.
// No era ruido del navegador, es que la altura la manda el largo de la
// EXPLICACIÓN DEL EJEMPLO y no el número de apartados — dos apartados más
// son media fila en dos columnas (unos 6 mm) y una explicación que pasa de
// una línea a tres son 8 mm. Con tres semillas, esa variación tapa el efecto
// que se quiere medir.
//
// Y DOCE Y NO OCHO desde que se vio que, con ocho, una batería que no se
// había tocado cambiaba 18 mm de una calibración a otra.
const SEMILLAS = Array.from({ length: 12 }, (_, k) => `cal-${k + 1}`);
// La plantilla corta en MAX_ACTIVIDADES, así que las baterías van por tandas.
const POR_TANDA = 8;

// Las de TODOS los temas: la tabla de alturas es una sola, por clave.
const TODAS = TEMAS_CON_GENERADOR.flatMap((tema) => todasLasBaterias(tema));

// La página de vista previa, con el import de la muestra por sustituir. Se
// escribe una copia por medición (ver `mide`).
const plantillaDePagina = readFileSync("assets/shared/hoja/vista-previa.html", "utf8")
  .replace(/HOJA_ENTEROS_1ESO/g, "HOJA_GENERADA");
const temporales = new Set();

const navegador = await chromium.launch({ executablePath: NAVEGADOR });
const pagina = await navegador.newPage();

// mm por píxel, medido en la propia página: con zoom, 297mm no son 1123px.
async function mmPorPx() {
  return pagina.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;width:0;height:100mm;";
    document.body.appendChild(probe);
    const alto = probe.getBoundingClientRect().height;
    probe.remove();
    return 100 / alto;
  });
}

// DOS FALLOS DE MEDICIÓN, LOS DOS DE VERDAD, que explican la forma de esto:
//
// 1. SE MEDÍA LA HOJA ANTERIOR. El script reescribía siempre el mismo archivo
//    y recargaba la misma página; si las dos escrituras caían en el mismo
//    segundo, el servidor contestaba "no ha cambiado" (misma fecha) y el
//    navegador usaba su copia vieja. Comprobado aislado: escribir 1,
//    escribir 2, leer… 1. Se notó porque el título de bloque midió 0 mm.
//    La primera tabla de alturas se calculó con este fallo.
//
// 2. DESACTIVAR LA CACHÉ PARA ARREGLARLO LO EMPEORÓ: dos pasadas idénticas
//    daban alturas distintas (±5 mm) porque las letras se volvían a
//    descargar en cada recarga, y según cuándo llegaran el texto se partía
//    en otra línea.
//
// Así que cada medición usa ARCHIVOS CON NOMBRE PROPIO —imposible confundir
// una hoja con otra— con la caché puesta, y además se espera a que la
// maquetación deje de moverse: se mide dos veces seguidas y solo vale cuando
// las dos coinciden.
let numero = 0;
async function mide(hoja) {
  numero += 1;
  const muestra = `assets/shared/hoja/muestras/_generada_tmp_${numero}.js`;
  const pag = `vp-tmp-${numero}.html`;
  writeFileSync(muestra, `export const HOJA_GENERADA = ${JSON.stringify(hoja, null, 2)};\n`);
  writeFileSync(pag, plantillaDePagina.replace("/assets/shared/hoja/muestras/enteros1eso.js", `/${muestra}`));
  temporales.add(muestra);
  temporales.add(pag);

  await pagina.goto(`http://localhost:${PUERTO}/${pag}`, { waitUntil: "networkidle" });
  await pagina.evaluate(() => document.fonts.ready);
  const alturas = () => pagina.evaluate(() => [...document.querySelectorAll(".hj-act, .hoja")]
    .map((el) => el.getBoundingClientRect().height.toFixed(2)).join(","));
  let antes = await alturas();
  for (let intento = 0; intento < 20; intento += 1) {
    await pagina.waitForTimeout(150);
    const ahora = await alturas();
    if (ahora === antes) break;
    antes = ahora;
    if (intento === 19) throw new Error(`la hoja ${numero} no deja de moverse: la medida no vale`);
  }

  const factor = await mmPorPx();
  const piezas = await pagina.evaluate(async () => {
    const mod = await import("/assets/shared/hoja/js/paginacionDeLaHoja.js");
    return mod.medirPiezas(document.querySelector(".hoja"));
  });
  // El margen vertical se MIDE también, en vez de escribir 22 aquí: es el
  // padding de la hoja, que en impresión es el margen de `@page`. Escribirlo
  // a mano sería el tercer sitio donde vive ese número.
  const margenPx = await pagina.evaluate(async () => {
    const mod = await import("/assets/shared/hoja/js/ajusteDelFolio.js");
    return mod.margenVerticalPx(document.querySelector(".hoja"));
  });
  return {
    margenMm: margenPx * factor,
    cabeceraMm: piezas.cabeceraPx * factor,
    actividadesMm: piezas.actividadesPx.map((px) => px * factor),
    pieMm: (piezas.piePx || 0) * factor,
  };
}

const alturas = {};
const cabeceras = [];
const pies = [];
const margenes = [];

for (const modo of MODOS_DE_APARTADOS) {
  for (const semilla of SEMILLAS) {
    for (let i = 0; i < TODAS.length; i += POR_TANDA) {
      const tanda = TODAS.slice(i, i + POR_TANDA);
      // UN AZAR POR BATERÍA, no uno por tanda. Con uno compartido, lo que
      // sale en una batería depende de cuántos números hayan gastado las de
      // delante, así que añadir una batería nueva al catálogo cambiaba las
      // muestras —y las alturas— de todas las demás.
      const ejercicios = tanda.map((b) => conEjemploResuelto(b.generador, crearAzar(`${b.clave}-${modo}-${semilla}`), {
        cuantos: apartadosDe(b, modo),
      }));
      // SIN TÍTULOS DE BLOQUE: lo que se mide aquí es la batería. Lo que
      // cuesta el título se mide aparte, abajo, con la misma tanda con y sin
      // él — si se mezclara, la primera batería de cada tanda saldría
      // inflada y nunca se mediría limpia.
      const actividades = ejercicios.map(aActividadDeHoja);
      const medida = await mide({ ...HOJA_ENTEROS_1ESO, esencial: null, ejemplos: [], actividades });

      cabeceras.push(medida.cabeceraMm);
      pies.push(medida.pieMm);
      margenes.push(medida.margenMm);
      ejercicios.forEach((ejercicio, j) => {
        const mm = medida.actividadesMm[j];
        if (!mm) return;
        alturas[ejercicio.clave] = alturas[ejercicio.clave] || {};
        alturas[ejercicio.clave][modo] = Math.max(alturas[ejercicio.clave][modo] || 0, mm);
      });
      process.stdout.write(".");
    }
  }
}

// LO QUE CUESTA UN TÍTULO DE BLOQUE: la misma tanda medida dos veces, con
// título en la primera actividad y sin él. La diferencia es el título.
const azarTitulo = crearAzar("coste-del-titulo");
const paraTitulo = TODAS.slice(0, POR_TANDA).map((b) => conEjemploResuelto(b.generador, azarTitulo, {
  cuantos: apartadosDe(b, "medio"),
})).map(aActividadDeHoja);
const base = { ...HOJA_ENTEROS_1ESO, esencial: null, ejemplos: [] };
const sin = await mide({ ...base, actividades: paraTitulo });
const con = await mide({
  ...base,
  actividades: paraTitulo.map((a, j) => (j === 0 ? { ...a, bloque: "TÍTULO DE PRUEBA" } : a)),
});
const tituloMm = Math.round(Math.max(0, con.actividadesMm[0] - sin.actividadesMm[0]) * 10) / 10;

await navegador.close();
temporales.forEach((f) => unlinkSync(f));

const faltan = TODAS.filter((b) => {
  const ej = b.generador(crearAzar("x"), { cuantos: b.minimo });
  return !alturas[ej.clave] || MODOS_DE_APARTADOS.some((m) => !alturas[ej.clave][m]);
});
if (faltan.length) {
  console.error(`\nsin medir: ${faltan.map((b) => b.generador.name).join(", ")}`);
  process.exit(1);
}

// COTA MONÓTONA. Más apartados no pueden ocupar menos sitio, así que el
// número de un modo nunca baja del anterior: se arrastra el máximo. Sin esto,
// el montador podría meter la versión GRANDE de una batería creyendo que
// ocupa menos que la mediana, y la hoja se saldría de folio.
for (const porModo of Object.values(alturas)) {
  let tope = 0;
  for (const modo of MODOS_DE_APARTADOS) {
    tope = Math.max(tope, porModo[modo]);
    porModo[modo] = tope;
  }
}

const redondea = (n) => Math.round(n * 10) / 10;
const cuerpo = Object.entries(alturas)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([clave, porModo]) => `  ${clave}: { ${
    MODOS_DE_APARTADOS.map((m) => `${m}: ${redondea(porModo[m])}`).join(", ")
  } },`)
  .join("\n");

writeFileSync(DESTINO, `// ALTURAS MEDIDAS DE CADA BATERÍA, EN MILÍMETROS DE FOLIO.
//
// ARCHIVO GENERADO: lo escribe \`tests/manual/calibraAlturas.mjs\` midiendo la
// hoja en Chromium. No se edita a mano — se vuelve a pasar el script.
//
// Medido el ${new Date().toISOString().slice(0, 10)} con ${SEMILLAS.length} semillas por batería.
// Cada número es el MÁXIMO de las semillas, no la media: una batería no mide
// siempre lo mismo (la explicación del ejemplo resuelto varía), y pasarse de
// folio es peor defecto que dejar blanco.
//
// SI CAMBIA EL CSS DE LA HOJA O EL CUERPO DE LETRA, ESTOS NÚMEROS MIENTEN.
// Hay un test que compara la lista de claves con el catálogo, pero ninguno
// puede detectar que la letra ha crecido: eso solo lo ve el navegador.

// El alto que queda para contenido en UN folio: 297 menos los dos márgenes
// de \`@page\`. Medido, no escrito: es el padding de la hoja en pantalla, que
// es el mismo número que el margen de impresión (lo vigila un test).
export const ALTO_UTIL_POR_FOLIO_MM = ${redondea(297 - Math.max(...margenes))};

export const ALTURA_DEL_TITULO_DE_BLOQUE_MM = ${tituloMm};
export const ALTURA_DE_LA_CABECERA_MM = ${redondea(Math.max(...cabeceras))};
export const ALTURA_DEL_PIE_MM = ${redondea(Math.max(...pies))};

export const ALTURA_DE_LA_BATERIA_MM = {
${cuerpo}
};
`);

console.log(`\n${DESTINO}`);
console.log(`cabecera ${redondea(Math.max(...cabeceras))} mm · pie ${redondea(Math.max(...pies))} mm `
  + `· título de bloque ${tituloMm} mm`);
for (const [clave, porModo] of Object.entries(alturas).sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`  ${clave.padEnd(30)} ${MODOS_DE_APARTADOS.map((m) => `${m} ${String(redondea(porModo[m])).padStart(6)}`).join("  ")}`);
}
