import fs from "node:fs";

// EL PDF DE LA PROGRAMACIÓN, HECHO EN EL SERVIDOR (Jorge, 24/9: en Safari
// salía distinta según sus opciones y con la dirección de la web).
export async function run({ test, assert }) {
  const RAIZ = new URL("../", import.meta.url).pathname;
  const { plantillas, lineasDeLaProgramacion } = await import("../server/lib/programacionPdf/imprimeProgramacionEnPdf.js");
  const { validaContenido } = await import("../api/programacion-pdf.js");

  test("cabecera y pie: qué documento es, el centro y 'página N de M'", () => {
    const l = lineasDeLaProgramacion({ curriculo: { materia: "Matemáticas" }, cabecera: { curso: 1 }, centro: "IES de prueba" });
    assert.equal(l.arriba, "Programación didáctica · Matemáticas · 1.º ESO");
    const p = plantillas(l);
    assert.match(p.footerTemplate, /IES de prueba/);
    assert.match(p.footerTemplate, /class="pageNumber"[\s\S]*class="totalPages"/);
  });

  test("lo que escribe el profesor no se cuela como HTML en la cabecera", () => {
    const p = plantillas({ arriba: "<img src=x onerror=alert(1)>", abajo: "A & B" });
    assert.equal(/<img/.test(p.headerTemplate), false);
    assert.match(p.footerTemplate, /A &amp; B/);
  });

  test("se rechaza lo que no es una programación", () => {
    assert.match(validaContenido({}), /Falta la programación/);
    assert.match(validaContenido({ contenido: { curriculo: {}, datos: {}, cabecera: {} } }), /Falta el currículo/);
    assert.equal(validaContenido({ contenido: { curriculo: { competencias: [] }, datos: {}, cabecera: {} } }), null);
    const enorme = { curriculo: { competencias: [], relleno: "x".repeat(1000 * 1024) }, datos: {}, cabecera: {} };
    assert.match(validaContenido({ contenido: enorme }), /demasiado grande/);
  });

  test("la función existe en Vercel con el Chromium empaquetado, como la de las hojas", () => {
    const v = JSON.parse(fs.readFileSync(`${RAIZ}vercel.json`, "utf8"));
    assert.deepEqual(v.functions["api/programacion-pdf.js"], v.functions["api/hoja-pdf.js"]);
  });

  test("la página del PDF pinta el MISMO documento que el editor", () => {
    const html = fs.readFileSync(`${RAIZ}assets/shared/programacion/programacion-imprimible.html`, "utf8");
    assert.match(html, /import \{ pintarDocumentoImprimible \} from "\/assets\/teacher\/js\/recursos\/programacion\/documentoDeProgramacion\.js"/);
    assert.match(html, /13-recursos-programacion\.css/);
  });
}
