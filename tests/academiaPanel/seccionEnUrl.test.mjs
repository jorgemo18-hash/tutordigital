import fs from "node:fs";

const RAIZ = new URL("../../", import.meta.url).pathname;

// UN F5 EN FINANZAS DEVOLVÍA A ALUMNOS.
//
// EL PROBLEMA (14/09/2026). La sección abierta vivía solo en una variable de
// JavaScript. Recargar en Finanzas volvía a Alumnos, el botón de atrás del
// navegador salía del panel entero, y no había forma de guardar un enlace —ni
// de mandárselo a nadie— apuntando a una pantalla concreta. En una herramienta
// que se usa una tarde entera, perder el sitio al recargar se paga muchas
// veces al día.
//
// SE USA EL HASH y no una ruta de verdad: el panel se sirve estático desde
// Vercel, así que `/admin/finanzas` necesitaría reescrituras en `vercel.json` y
// que el servidor devolviera el mismo HTML para cada sección. El hash no llega
// al servidor — y de paso no acaba en ningún log de acceso.
export async function run({ test, assert }) {
  const { seccionDeUrl, escribirSeccionEnUrl, escucharUrl } = await import(
    "../../assets/academia/admin/js/seccionEnUrl.js"
  );

  const VISIBLES = ["alumnos", "profesores", "finanzas", "envio_familias", "ajustes"];

  // ── Leer la URL ──────────────────────────────────────────────────────

  test("un hash válido dice qué sección abrir", () => {
    assert.equal(seccionDeUrl("#finanzas", VISIBLES), "finanzas");
    assert.equal(seccionDeUrl("finanzas", VISIBLES), "finanzas", "con o sin almohadilla");
  });

  test("el id va tal cual, con su guion bajo", () => {
    // Traducirlo a `envio-familias` sería más bonito y obligaría a mantener un
    // mapa de ida y vuelta entre dos nombres de lo mismo. Un solo nombre.
    assert.equal(seccionDeUrl("#envio_familias", VISIBLES), "envio_familias");
  });

  test("sin hash no se pide nada, y manda el valor por defecto", () => {
    assert.equal(seccionDeUrl("", VISIBLES), null);
    assert.equal(seccionDeUrl("#", VISIBLES), null);
    assert.equal(seccionDeUrl(undefined, VISIBLES), null);
  });

  test("REGRESIÓN: un hash de una sección que este centro no tiene se ignora", () => {
    // Un enlace guardado a `#horario` en un centro que luego se quedó con un
    // solo profesor —donde Horario desaparece del menú— no puede dejar una
    // pantalla abierta y ningún elemento marcado en el menú.
    assert.equal(seccionDeUrl("#horario", VISIBLES), null);
    assert.equal(seccionDeUrl("#dar_clase", VISIBLES), null);
    assert.equal(seccionDeUrl("#inventado", VISIBLES), null);
  });

  // ── Escribir la URL ──────────────────────────────────────────────────

  test("al cambiar de sección se escribe en la URL", () => {
    const ubicacion = { hash: "" };
    escribirSeccionEnUrl("finanzas", ubicacion);
    assert.equal(ubicacion.hash, "finanzas");
  });

  test("REGRESIÓN: no se reescribe el hash que ya está puesto", () => {
    // Volver a asignar el mismo hash mete una entrada más en el historial:
    // el botón de atrás tendría que pulsarse dos veces para moverse una.
    let escrituras = 0;
    const ubicacion = {
      _h: "#finanzas",
      get hash() { return this._h; },
      set hash(v) { escrituras++; this._h = `#${v}`; },
    };
    escribirSeccionEnUrl("finanzas", ubicacion);
    assert.equal(escrituras, 0);
  });

  // ── Atrás y adelante ─────────────────────────────────────────────────

  function fakeVentana(hashInicial = "") {
    const oyentes = {};
    return {
      location: { hash: hashInicial },
      addEventListener: (ev, fn) => { oyentes[ev] = fn; },
      removeEventListener: (ev) => { delete oyentes[ev]; },
      _fire: (hash) => { oyentes.hashchange?.call(null, { newURL: hash }); },
      _set: function (hash) { this.location.hash = hash; },
      _tiene: () => Boolean(oyentes.hashchange),
    };
  }

  test("el botón de atrás cambia de sección", () => {
    const ventana = fakeVentana("#finanzas");
    let activo = "finanzas";
    const pedidas = [];
    escucharUrl({
      idsVisibles: VISIBLES,
      getActivo: () => activo,
      onSeccion: (id) => { pedidas.push(id); activo = id; },
      ventana,
    });
    ventana._set("#alumnos");
    ventana._fire();
    assert.deepEqual(pedidas, ["alumnos"]);
  });

  test("REGRESIÓN: escribir el hash de la sección ya abierta NO la vuelve a pintar", () => {
    // Sin esta comprobación, cada clic del menú renderiza dos veces —y con
    // ello repite todas las peticiones de la pantalla—, porque seleccionar
    // escribe el hash y el hash dispara el evento.
    const ventana = fakeVentana("#finanzas");
    const pedidas = [];
    escucharUrl({
      idsVisibles: VISIBLES,
      getActivo: () => "finanzas",
      onSeccion: (id) => pedidas.push(id),
      ventana,
    });
    ventana._fire();
    assert.deepEqual(pedidas, []);
  });

  test("un hash inválido por el camino no cambia nada", () => {
    const ventana = fakeVentana("#alumnos");
    const pedidas = [];
    escucharUrl({
      idsVisibles: VISIBLES, getActivo: () => "alumnos",
      onSeccion: (id) => pedidas.push(id), ventana,
    });
    ventana._set("#basura");
    ventana._fire();
    assert.deepEqual(pedidas, [], "se queda donde está, no vuelve al inicio");
  });

  test("sin ventana (o sin eventos) no revienta y devuelve una baja vacía", () => {
    const quitar = escucharUrl({ idsVisibles: VISIBLES, ventana: null });
    assert.equal(typeof quitar, "function");
    quitar();
  });

  // ── El cableado ──────────────────────────────────────────────────────

  test("REGRESIÓN: el panel arranca leyendo la URL, no siempre en Alumnos", () => {
    const panel = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/academiaAdmin.js`, "utf8"
    ).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

    assert.match(
      panel, /let activeId = seccionDeUrl\(window\.location\.hash, idsVisibles\) \|\| "alumnos"/,
      "la URL manda al arrancar, y Alumnos es el respaldo"
    );
    assert.match(panel, /escribirSeccionEnUrl\(sectionId\)/, "y seleccionar la escribe");
    assert.match(panel, /escucharUrl\(/, "y el botón de atrás funciona");
  });

  test("«ajustes» es enlazable aunque no venga en la lista del menú", () => {
    // buildSidebar la pinta aparte, al pie: si se sacara la lista solo de
    // `sections`, `#ajustes` sería un enlace muerto.
    const panel = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/academiaAdmin.js`, "utf8"
    );
    assert.match(panel, /\[\.\.\.sections\.map\(\(s\) => s\.id\), "ajustes"\]/);
    assert.match(panel, /filter\(\(id\) => id && SECTION_RENDERERS\[id\]\)/,
      "y una sección sin renderizador no es enlazable");
  });
}
