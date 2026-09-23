import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// EL CÓDIGO DE COBRO ES DE LA FAMILIA.
//
// Vivió un día en el alumno (migración 124). Jorge, 23/09, después de verlo
// funcionando: *"el código, no dentro del alumno sino al crear o modificar
// familia, ya que es para cobrar a toda la familia, un código por familia"*.
// Pasó a la familia en la 125.
//
// Lo que se vigila aquí son las cosas que se rompen sin dar ningún error:
//
//   1. que el vacío viaje como NULL, no como "" — el índice único perdona
//      los NULL y no las cadenas vacías;
//   2. que el backend reconozca el choque por el nombre LITERAL del índice
//      de la migración;
//   3. que el aviso llegue al campo del código, en la sección de familia;
//   4. que elegir una familia del buscador y editarla NO borre su código
//      (ni su IBAN, que es donde estaba el agujero de antes).
export async function run({ test, assert }) {
  const { buildFamiliaFields } = await import(
    "../../assets/academia/admin/js/drawer/familia/familiaFields.js"
  );
  const { esCodigoRepetido, INDICE_CODIGO_FAMILIA, MENSAJE_CODIGO_REPETIDO } = await import(
    "../../server/lib/academiaFamilias/codigoRepetido.js"
  );
  const { FamiliaNuevaSchema, AlumnoUpdateSchema } = await import(
    "../../server/lib/academiaAlumnoSchemas.js"
  );
  const { CreateFamiliaSchema } = await import("../../server/routes/v1/academia.familias.routes.js");

  const SQL = fs.readFileSync(`${RAIZ}supabase/migrations/125_academia_familias_codigo.sql`, "utf8");
  const leer = (ruta) => fs.readFileSync(`${RAIZ}${ruta}`, "utf8");

  // ── 1. El vacío es NULL ───────────────────────────────────────────────

  test("EL CÓDIGO VACÍO VIAJA COMO NULL, no como cadena vacía", () => {
    // Con "" la SEGUNDA familia sin código chocaría con la primera, porque
    // el índice parcial solo perdona los NULL. Y NULL es también lo que
    // permite BORRAR un código: vacía la columna.
    assert.equal(buildFamiliaFields({ nombre: "F" }).getValue().codigo, null);
    assert.equal(buildFamiliaFields({ nombre: "F", codigo: "   " }).getValue().codigo, null);
  });

  test("se guarda tal cual lo escribe la academia", () => {
    for (const escrito of ["A-14", "2026/007", "LUCIA-M", "14"]) {
      assert.equal(buildFamiliaFields({ nombre: "F", codigo: escrito }).getValue().codigo, escrito);
    }
  });

  test("los DOS esquemas de familia lo aceptan, y convierten \"\" en nada", () => {
    // Dos puertas: crear la familia desde el selector (CreateFamiliaSchema)
    // y crearla/editarla dentro del alta del alumno (FamiliaNuevaSchema).
    // Si solo una lo aceptara, el código se perdería en silencio por la
    // otra: zod descarta las claves que no conoce sin avisar.
    for (const [nombre, esquema] of [["FamiliaNueva", FamiliaNuevaSchema], ["CreateFamilia", CreateFamiliaSchema]]) {
      assert.equal(esquema.parse({ nombre: "F", codigo: "  A-14 " }).codigo, "A-14", `${nombre} lo pierde`);
      assert.equal(esquema.parse({ nombre: "F", codigo: "" }).codigo, undefined, `${nombre} guardaría ""`);
      assert.equal(esquema.parse({ nombre: "F", codigo: null }).codigo, null, `${nombre} no deja borrarlo`);
    }
  });

  test("EL ALUMNO YA NO LLEVA CÓDIGO", () => {
    // Si siguiera aceptándolo, habría dos códigos de cobro para lo mismo y
    // el día que no coincidieran nadie sabría cuál vale.
    assert.equal("codigo" in AlumnoUpdateSchema.parse({ codigo: "A-14" }), false);
    assert.ok(!/codigo\s*:/.test(leer("assets/academia/admin/js/drawer/datosSection.js")),
      "la sección de datos del alumno sigue mandando un código");
  });

  // ── 2. El backend reconoce el choque ──────────────────────────────────

  test("EL NOMBRE DEL ÍNDICE DEL BACKEND ES EL DE LA MIGRACIÓN", () => {
    // Si se renombra el índice en la migración y no aquí, el choque deja de
    // reconocerse y el admin ve un 500 en vez del aviso.
    assert.ok(SQL.includes(INDICE_CODIGO_FAMILIA), `"${INDICE_CODIGO_FAMILIA}" no está en la 125`);
    assert.ok(/create unique index/i.test(SQL));
    assert.ok(/academia_familias \(tenant_id, codigo\)/.test(SQL), "sin tenant_id chocarían dos academias");
    assert.ok(/where\s+codigo\s+is\s+not\s+null/i.test(SQL));
  });

  test("la migración NO borra la columna del alumno todavía", () => {
    // El código desplegado cuando se aplica escribe esa columna en cada
    // guardado de alumno. Borrarla antes de subir el código nuevo rompería
    // el guardado de TODOS los alumnos en el rato entre las dos cosas.
    assert.ok(!/drop\s+column/i.test(SQL.replace(/--.*$/gm, "")), "la 125 borra una columna");
  });

  test("se reconoce el 23505 de ESE índice y no el de otros", () => {
    assert.equal(esCodigoRepetido({ code: "23505", constraint: INDICE_CODIGO_FAMILIA }), true);
    assert.equal(esCodigoRepetido({ code: "23505", message: `violates unique constraint "${INDICE_CODIGO_FAMILIA}"` }), true);
    assert.equal(esCodigoRepetido({ code: "23505", constraint: "academia_alumnos_codigo_unico" }), false);
    assert.equal(esCodigoRepetido({ code: "23503", constraint: INDICE_CODIGO_FAMILIA }), false);
    assert.equal(esCodigoRepetido(null), false);
  });

  test("TODAS las escrituras de familia traducen el choque", () => {
    // Una familia se escribe por cinco caminos: crearla desde el selector,
    // y crearla o editarla dentro del alta y de la edición del alumno. El
    // que se quede sin traducir devuelve un 500 en vez del aviso.
    const alumnos = leer("server/routes/v1/academia.alumnos.routes.js");
    const familias = leer("server/routes/v1/academia.familias.routes.js");
    assert.equal(alumnos.split("esCodigoRepetido(").length - 1, 4, "alta y edición, crear y editar familia");
    assert.equal(familias.split("esCodigoRepetido(").length - 1, 1, "crear desde el selector");
  });

  // ── 3. El aviso llega al campo ────────────────────────────────────────

  test("EL AVISO SALE PEGADO AL CAMPO DEL CÓDIGO", () => {
    const f = buildFamiliaFields({ nombre: "F", codigo: "A-14" });
    assert.equal(f.wrap.querySelector(".ac-field-hint--error"), null);
    f.marcarCodigoRepetido(MENSAJE_CODIGO_REPETIDO);
    assert.equal(f.wrap.querySelector(".ac-field-hint--error")?.textContent, MENSAJE_CODIGO_REPETIDO);
    assert.ok(f.wrap.querySelector("input.ac-input-amber"), "el campo tiene que quedar marcado");
  });

  test("y se quita en cuanto se corrige el código", () => {
    // Dejarlo en rojo mientras se escribe otro distinto haría pensar que
    // sigue repetido.
    const f = buildFamiliaFields({ nombre: "F", codigo: "A-14" });
    f.marcarCodigoRepetido(MENSAJE_CODIGO_REPETIDO);
    const input = f.wrap.querySelector("input.ac-input-amber");
    input.value = "A-15";
    input.dispatchEvent(new window.Event("input"));
    assert.equal(f.wrap.querySelector(".ac-field-hint--error"), null);
  });

  test("el error del guardado del alumno va a la sección de FAMILIA", () => {
    const acciones = leer("assets/academia/admin/js/drawer/alumnoDrawerActions.js");
    assert.ok(/familia\?\.marcarCodigoRepetido/.test(acciones), "el aviso se sigue mandando al alumno");
    const selector = leer("assets/academia/admin/js/drawer/familia/selectorFamiliaDrawer.js");
    assert.ok(/codigo_repetido/.test(selector), "crear familia desde el selector no marca el campo");
  });

  // ── 4. Elegir y editar no borra nada ──────────────────────────────────

  test("EL BUSCADOR DEVUELVE LA FAMILIA ENTERA", () => {
    // El agujero: la lista del buscador traía cuatro campos (id, nombre,
    // email, método de pago). Lo que se elige ahí se queda como familia
    // seleccionada, y al pulsar "Editar familia" los campos que no venían
    // salían vacíos y el guardado los BORRABA — el código, y antes que él
    // el IBAN y el DNI.
    const familias = leer("server/routes/v1/academia.familias.routes.js");
    const columnas = familias.match(/const COLUMNAS_FAMILIA = ([^;]+);/)?.[1] || "";
    for (const c of ["codigo", "codigo_sepa", "dni", "direccion", "telefono"]) {
      assert.ok(new RegExp(`\\b${c}\\b`).test(columnas), `el buscador no trae ${c}`);
    }
    const usos = familias.split(".select(COLUMNAS_FAMILIA)").length - 1;
    assert.equal(usos, 2, "el GET y el POST tienen que devolver lo mismo");
  });

  test("editar una familia con código y no tocarlo lo conserva", () => {
    const f = buildFamiliaFields({ nombre: "Familia Ruiz", codigo: "A-14", metodo_pago: "bizum" });
    assert.equal(f.getValue().codigo, "A-14");
  });
}
