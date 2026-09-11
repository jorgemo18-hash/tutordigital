import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// Filtrar "Archivados" por año de baja.
//
// POR QUÉ (Jorge, 11/09/2026): "los alumnos archivados podrían verse por año
// en el que se archivan, dentro de 5 años tendré muchos alumnos y es una
// manera de buscarlos más rápido". Archivados es la única pestaña que solo
// crece —cada curso deja ahí a los que se fueron y nunca se vacía— y está
// paginada de 30 en 30, así que a unos cursos vista buscar a alguien es
// pasar páginas.
//
// El año sale de `fecha_baja`, que es lo que distingue un archivado de un
// borrador (estado.js): un borrador tiene activo=false y fecha_baja NULL.
export async function run({ test, assert }) {
  const { aniosDeArchivo, aplicarFiltroAnioBaja } = await import(
    "../../server/lib/academiaAlumnos/aniosArchivo.js"
  );
  const { buildFiltroAnio } = await import(
    "../../assets/academia/admin/js/alumnosFiltroAnio.js"
  );

  test("agrupa por año y cuenta, del más reciente al más antiguo", () => {
    const anios = aniosDeArchivo([
      { fecha_baja: "2026-09-11" }, { fecha_baja: "2026-08-29" },
      { fecha_baja: "2028-06-01" },
      { fecha_baja: "2027-01-15" }, { fecha_baja: "2027-12-31" }, { fecha_baja: "2027-07-07" },
    ]);
    assert.deepEqual(anios, [
      { anio: 2028, total: 1 },
      { anio: 2027, total: 3 },
      { anio: 2026, total: 2 },
    ]);
  });

  test("el 31 de diciembre cuenta en su año, no en el siguiente", () => {
    // Con un corte hecho a mano (new Date, zonas horarias) esto es
    // exactamente lo que se rompe. Se recorta la cadena YMD y no hay Date.
    assert.deepEqual(aniosDeArchivo([{ fecha_baja: "2027-12-31" }]), [{ anio: 2027, total: 1 }]);
    assert.deepEqual(aniosDeArchivo([{ fecha_baja: "2028-01-01" }]), [{ anio: 2028, total: 1 }]);
  });

  test("las filas sin fecha (un borrador) no cuentan", () => {
    assert.deepEqual(aniosDeArchivo([{ fecha_baja: null }, { fecha_baja: "" }, {}]), []);
    assert.deepEqual(aniosDeArchivo(), []);
  });

  test("el filtro acota el año COMPLETO, de enero a diciembre", () => {
    const llamadas = [];
    const queryFalsa = {
      gte(col, val) { llamadas.push(["gte", col, val]); return this; },
      lte(col, val) { llamadas.push(["lte", col, val]); return this; },
    };
    aplicarFiltroAnioBaja(queryFalsa, 2027);
    assert.deepEqual(llamadas, [
      ["gte", "fecha_baja", "2027-01-01"],
      ["lte", "fecha_baja", "2027-12-31"],
    ]);
  });

  test("un año que no es un número no toca la query", () => {
    // Si dejara la query a medias, la pestaña devolvería la lista entera o
    // ninguna fila sin que nada lo explicara.
    const sinTocar = { gte: () => { throw new Error("no debería llamarse"); } };
    assert.equal(aplicarFiltroAnioBaja(sinTocar, "pepe"), sinTocar);
    assert.equal(aplicarFiltroAnioBaja(sinTocar, undefined), sinTocar);
  });

  // ── Los chips ────────────────────────────────────────────────────────

  test("con UN solo año no se pinta nada", () => {
    // Es el caso de hoy: las 10 bajas de Lyceo son todas de 2026. Un filtro
    // con una única opción ocupa una fila y no hace nada; aparece solo el
    // día que haya un segundo año.
    assert.equal(buildFiltroAnio([{ anio: 2026, total: 10 }], null, () => {}), null);
    assert.equal(buildFiltroAnio([], null, () => {}), null);
    assert.equal(buildFiltroAnio(undefined, null, () => {}), null);
  });

  test("con dos o más años salen los chips, con 'Todos' delante", () => {
    const chips = buildFiltroAnio(
      [{ anio: 2027, total: 3 }, { anio: 2026, total: 10 }], null, () => {}
    );
    const textos = [...chips.querySelectorAll("button")].map((b) => b.textContent);
    assert.deepEqual(textos, ["Todos · 13", "2027 · 3", "2026 · 10"]);
  });

  test("el número va en el chip: informa antes de pulsarlo", () => {
    const chips = buildFiltroAnio([{ anio: 2027, total: 3 }, { anio: 2026, total: 10 }], 2027, () => {});
    const encendidos = [...chips.querySelectorAll("button.on")].map((b) => b.textContent);
    assert.deepEqual(encendidos, ["2027 · 3"], "solo el año activo va encendido");
  });

  test("volver a pulsar el año activo no hace nada", () => {
    // Para quitar el filtro está "Todos". Que el mismo clic encienda y
    // apague deja al usuario sin saber si ve todo o una parte.
    const elegidos = [];
    const chips = buildFiltroAnio(
      [{ anio: 2027, total: 3 }, { anio: 2026, total: 10 }], 2027, (a) => elegidos.push(a)
    );
    const botones = [...chips.querySelectorAll("button")];
    botones.find((b) => b.textContent.startsWith("2027")).click();
    assert.deepEqual(elegidos, [], "no debería haber emitido nada");
    botones.find((b) => b.textContent.startsWith("Todos")).click();
    assert.deepEqual(elegidos, [null], "'Todos' sí, y manda null");
  });

  // ── Cableado ─────────────────────────────────────────────────────────

  test("REGRESIÓN: el año solo se aplica en Archivados", () => {
    // En Activos no hay fecha_baja: aplicarlo ahí vaciaría la pestaña. Y se
    // ignora en vez de devolver 400, para que un enlace viejo con ?anio= no
    // reviente.
    const ruta = fs.readFileSync(
      new URL("../../server/routes/v1/academia.alumnos.routes.js", import.meta.url), "utf8"
    );
    assert.match(ruta, /estado === "archivado" && anio/);
    assert.match(ruta, /if \(estado === "archivado"\) \{/, "los años solo se consultan en esa pestaña");
  });

  test("REGRESIÓN: los años viajan con la lista, no en una segunda petición", () => {
    // Dos peticiones distintas para la lista y sus filtros es la forma de
    // que un día los chips digan 2027 y la lista no tenga a nadie de 2027.
    const api = fs.readFileSync(
      new URL("../../assets/academia/admin/js/api.js", import.meta.url), "utf8"
    );
    assert.match(api, /anios:\s*data\.anios\s*\|\|\s*\[\]/);
    assert.match(api, /params\.set\("anio"/);
  });

  test("al cambiar de pestaña el año se olvida", () => {
    // Si no, volver a Archivados enseñaría una lista recortada por un
    // filtro que ya no se está viendo.
    const lista = fs.readFileSync(
      new URL("../../assets/academia/admin/js/alumnosList.js", import.meta.url), "utf8"
    );
    assert.match(lista, /activeTabId = tabId;[\s\S]{0,400}anioActivo = null;/);
  });
}
