import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// EN "ENVÍO A FAMILIAS" SOLO SALEN LAS FAMILIAS ACCIONABLES.
//
// EL PROBLEMA (Jorge, 12/09/2026): *"en envío a familias no tiene sentido que
// salgan los alumnos que no están activos, no?"*.
//
// LOS NÚMEROS DE LYCEO ese día, comprobados en producción: de **41 familias
// activas**, **17 no pueden recibir nada** — 9 solo con alumnos archivados, 7
// solo con borradores y 1 sin ningún alumno vinculado (la "Noelia Nieto
// Oliván" duplicada). El 41 % de la lista, con un texto que además engaña:
// "Sin recibo ni informe este mes" se lee como trabajo pendiente cuando lo
// que pasa es que no se les puede generar nada.
//
// Y EL LOTE YA LAS SALTABA: `generarParaFamiliasSinRecibo` hace
// `if (!alumnosActivos.length) continue;`. La lista era el único sitio donde
// parecían estar esperando algo.
export async function run({ test, assert }) {
  const { separarPorAlumnosActivos, textoSinActivos, buildPieSinActivos } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/familiasSinActivos.js"
  );
  const { buildFamiliasLista } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/familiasLista.js"
  );

  const conDos = {
    familia_id: "f1", familia_nombre: "Alba Ferrer Botaya", familia_email: "a@x.es",
    alumnos_activos: [{ id: "a1", curso: "1º ESO" }, { id: "a2", curso: "4º ESO" }], recibo: null,
  };
  const soloArchivados = {
    familia_id: "f2", familia_nombre: "Ana Forcén Quecar", familia_email: "b@x.es",
    alumnos_activos: [], recibo: null,
  };
  const soloBorradores = {
    familia_id: "f3", familia_nombre: "Aissatu Balde", familia_email: "c@x.es",
    alumnos_activos: [], recibo: null,
  };

  test("separa las accionables de las que no pueden recibir nada", () => {
    const { conActivos, sinActivos } = separarPorAlumnosActivos([conDos, soloArchivados, soloBorradores]);
    assert.deepEqual(conActivos.map((f) => f.familia_id), ["f1"]);
    assert.deepEqual(sinActivos.map((f) => f.familia_id), ["f2", "f3"]);
  });

  test("conserva el orden en que vienen, que es por nombre desde el backend", () => {
    const { sinActivos } = separarPorAlumnosActivos([soloBorradores, soloArchivados]);
    assert.deepEqual(sinActivos.map((f) => f.familia_nombre), ["Aissatu Balde", "Ana Forcén Quecar"]);
  });

  test("una lista vacía o basura no revienta", () => {
    assert.deepEqual(separarPorAlumnosActivos([]), { conActivos: [], sinActivos: [] });
    assert.deepEqual(separarPorAlumnosActivos(), { conActivos: [], sinActivos: [] });
    const { sinActivos } = separarPorAlumnosActivos([{ familia_id: "x" }]);
    assert.equal(sinActivos.length, 1, "sin la clave alumnos_activos cuenta como sin activos");
  });

  // ── Lo que se ve ──────────────────────────────────────────────────────

  test("REGRESIÓN: la lista solo pinta las accionables", () => {
    const { conActivos } = separarPorAlumnosActivos([conDos, soloArchivados, soloBorradores]);
    const el = buildFamiliasLista(conActivos, { selectedId: null, onSelect: () => {} });
    const nombres = [...el.querySelectorAll(".ef-fila-nombre")].map((n) => n.textContent);
    assert.deepEqual(nombres, ["Alba Ferrer Botaya"]);
  });

  test("el pie dice cuántas son y, al abrirlo, quiénes", () => {
    const pie = buildPieSinActivos([soloArchivados, soloBorradores]);
    assert.equal(pie.tagName, "DETAILS", "cerrado ocupa una línea");
    assert.match(pie.querySelector("summary").textContent, /^2 familias sin alumnos activos/);
    assert.deepEqual(
      [...pie.querySelectorAll(".ef-sin-activos-fila")].map((f) => f.textContent),
      ["Ana Forcén Quecar", "Aissatu Balde"]
    );
  });

  test("en singular se lee en castellano", () => {
    assert.match(textoSinActivos([soloArchivados]), /^1 familia sin alumnos activos/);
  });

  test("sin ninguna, no hay pie — un centro nuevo no arrastra histórico", () => {
    assert.equal(buildPieSinActivos([]), null);
    assert.equal(textoSinActivos([]), "");
  });

  test("REGRESIÓN: el vacío de la lista ya no dice 'no hay familias activas'", () => {
    // Con el filtro puesto, la lista puede quedar vacía HABIENDO familias.
    // El texto viejo afirmaba algo falso.
    const el = buildFamiliasLista([], { selectedId: null, onSelect: () => {} });
    assert.match(el.querySelector(".ac-empty").textContent, /Ninguna familia con alumnos activos/);
  });

  // ── El cableado, que es donde esto se rompe ───────────────────────────

  const SECCION = fs.readFileSync(
    `${RAIZ}assets/academia/admin/js/sections/envioFamiliasSection.js`, "utf8"
  );

  test("REGRESIÓN: el filtro se aplica AL CARGAR, no en cada uso", () => {
    // `familias` lo leen la lista, los dos avisos, el contador de
    // pendientes, el botón de regenerar y el lote de "Enviar a todos". Si el
    // filtro estuviera en cada sitio, el próximo consumidor se olvidaría —
    // y lo peor sería un aviso nombrando familias que no están en la lista.
    assert.match(SECCION, /separarPorAlumnosActivos\(todas\)/);
    assert.equal(
      (SECCION.match(/await cargarFamilias\(\)/g) || []).length, 3,
      "los tres sitios que recargan: primer render, cambio de período y tras enviar"
    );
    assert.equal(
      /fetchRecibos\(\{ mes, anio \}\)/.test(SECCION.replace(/async function cargarFamilias[\s\S]*?\n  \}/, "")),
      false,
      "y ninguno pide las familias por su cuenta saltándose el filtro"
    );
  });

  test("REGRESIÓN: el pie se pinta con la lista, no aparte", () => {
    // Si se pintara en otro sitio, una recarga podría dejar la lista
    // filtrada y el pie con los datos del mes anterior.
    assert.match(SECCION, /buildPieSinActivos\(familiasSinActivos\)/);
    const render = SECCION.slice(SECCION.indexOf("function renderLista"));
    assert.match(render.slice(0, 700), /buildFamiliasLista[\s\S]*?buildPieSinActivos/);
  });

  test("el criterio es alumnos_activos, NO el estado 'vacío' de la familia", () => {
    // Se parecen y no son lo mismo: una familia CON alumnos activos a la que
    // se le olvidó generar el recibo también sale como "vacío", y esa sí es
    // accionable — es el caso que "Por emitir" saca a la luz en Finanzas.
    // Filtrar por el estado esconderría justo a las que hay que facturar.
    const modulo = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/sections/envioFamilias/familiasSinActivos.js`, "utf8"
    );
    assert.match(modulo, /alumnos_activos \|\| \[\]\)\.length/);
    assert.equal(
      /calcularEstadoFamilia|estado\.tipo/.test(modulo), false,
      "no puede depender del estado de envío"
    );

    const olvidada = {
      familia_id: "f9", familia_nombre: "Olvidada", familia_email: "o@x.es",
      alumnos_activos: [{ id: "a9", curso: "2º ESO" }], recibo: null,
    };
    const { conActivos } = separarPorAlumnosActivos([olvidada]);
    assert.equal(conActivos.length, 1, "sin recibo pero con alumno activo: SÍ sale");
  });

  test("REGRESIÓN: el lote sigue saltándose a las familias sin alumnos activos", () => {
    // Es el motivo por el que esconderlas es correcto y no una pérdida: si
    // esto cambiara, habría familias facturables fuera de la lista.
    const generar = fs.readFileSync(
      `${RAIZ}server/routes/v1/academia-recibos/generar.routes.js`, "utf8"
    );
    assert.match(generar, /if \(!alumnosActivos\.length\) continue;/);
  });
}
