import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// EL CÓDIGO CON EL QUE LA ACADEMIA COBRA EN EL BANCO.
//
// Jorge, 23/09/2026: *"cuando yo hago los cobros en el banco, cada alumno
// tiene un código"*. Lo escribe él, no lo genera el programa, y no puede
// repetirse dentro de la academia.
//
// Lo que se prueba aquí son las tres cosas que pueden romperse sin dar
// ningún error visible:
//
//   1. que el campo vacío viaje como NULL y no como "". Es el fallo más
//      fácil de cometer y el más difícil de ver: el índice único perdona los
//      NULL pero NO las cadenas vacías, así que el SEGUNDO alumno sin código
//      sería rechazado por chocar con el primero.
//   2. que el backend reconozca la violación del índice. Se compara contra
//      el nombre LITERAL de la migración: si alguien renombra el índice, el
//      error deja de reconocerse y sale un 500.
//   3. que el aviso llegue al campo, no solo a la cabecera del drawer.
export async function run({ test, assert }) {
  const { buildDatosSection } = await import(
    "../../assets/academia/admin/js/drawer/datosSection.js"
  );
  const { esCodigoRepetido, INDICE_CODIGO_ALUMNO, MENSAJE_CODIGO_REPETIDO } = await import(
    "../../server/lib/academiaAlumnos/codigoRepetido.js"
  );
  const { AlumnoUpdateSchema } = await import(
    "../../server/lib/academiaAlumnoSchemas.js"
  );

  const SQL = fs.readFileSync(`${RAIZ}supabase/migrations/124_academia_alumnos_codigo.sql`, "utf8");

  // ── 1. El vacío es NULL, no "" ────────────────────────────────────────

  test("EL CÓDIGO VACÍO VIAJA COMO NULL, no como cadena vacía", () => {
    // El índice único es parcial (`where codigo is not null`): perdona los
    // NULL y no las cadenas vacías. Con "" el segundo alumno sin código
    // chocaría con el primero y el alta se rechazaría sin motivo aparente.
    const sec = buildDatosSection({ nombre: "Lucía", curso: "1º ESO" });
    assert.equal(sec.getValue().codigo, null);
  });

  test("y los espacios sueltos también son NULL", () => {
    const sec = buildDatosSection({ nombre: "Lucía", curso: "1º ESO", codigo: "   " });
    assert.equal(sec.getValue().codigo, null);
  });

  test("el backend también convierte \"\" en nada, no lo escribe", () => {
    // Defensa en profundidad: un PATCH no pasa por la pantalla.
    const conVacio = AlumnoUpdateSchema.parse({ codigo: "" });
    assert.equal(conVacio.codigo, undefined, "un \"\" escribiría una cadena vacía en la columna");
    assert.equal(AlumnoUpdateSchema.parse({ codigo: "  A-14  " }).codigo, "A-14");
  });

  test("el código se guarda tal cual lo escribe la academia", () => {
    // Formato libre a propósito: cada academia usa el suyo. Validarlo contra
    // un patrón inventado aquí rechazaría códigos que su banco acepta.
    for (const escrito of ["A-14", "2026/007", "LUCIA-M", "14"]) {
      const sec = buildDatosSection({ nombre: "x", curso: "1º ESO", codigo: escrito });
      assert.equal(sec.getValue().codigo, escrito);
    }
  });

  // ── 2. El backend reconoce el choque ──────────────────────────────────

  test("EL NOMBRE DEL ÍNDICE DEL BACKEND ES EL DE LA MIGRACIÓN", () => {
    // La costura. El backend reconoce el código repetido buscando el nombre
    // del índice dentro del error de PostgreSQL. Si alguien renombra el
    // índice en la migración, aquí no pasa nada visible: simplemente deja de
    // reconocerse y el admin ve un 500 en vez del aviso.
    assert.ok(
      SQL.includes(INDICE_CODIGO_ALUMNO),
      `el índice "${INDICE_CODIGO_ALUMNO}" no está en la migración 124`,
    );
  });

  test("la migración crea el índice ÚNICO, por centro y solo con código", () => {
    assert.ok(/create unique index/i.test(SQL), "sin `unique` no impide nada");
    assert.ok(/\(tenant_id, codigo\)/.test(SQL), "sin tenant_id, dos academias chocarían entre sí");
    assert.ok(
      /where\s+codigo\s+is\s+not\s+null/i.test(SQL),
      "sin el `where`, el índice se llena de entradas de alumnos sin código",
    );
  });

  test("se reconoce el 23505 de ESE índice y no el de otros", () => {
    assert.equal(esCodigoRepetido({ code: "23505", constraint: INDICE_CODIGO_ALUMNO }), true);
    assert.equal(
      esCodigoRepetido({ code: "23505", message: `duplicate key value violates unique constraint "${INDICE_CODIGO_ALUMNO}"` }),
      true,
      "PostgREST a veces solo trae el nombre dentro del mensaje",
    );
    assert.equal(
      esCodigoRepetido({ code: "23505", constraint: "academia_familias_email_unico" }),
      false,
      "otro índice único de la tabla no es un código repetido",
    );
    assert.equal(esCodigoRepetido({ code: "23503", constraint: INDICE_CODIGO_ALUMNO }), false);
    assert.equal(esCodigoRepetido(null), false);
    assert.equal(esCodigoRepetido({}), false);
  });

  test("las rutas de alta y de edición traducen el choque, las dos", () => {
    // Las dos, porque el código se puede poner al crear y al editar. Que
    // solo una lo traduzca deja la otra devolviendo un 500.
    const rutas = fs.readFileSync(`${RAIZ}server/routes/v1/academia.alumnos.routes.js`, "utf8");
    const veces = rutas.split("esCodigoRepetido(").length - 1;
    assert.equal(veces, 2, `se comprueba en ${veces} sitio(s): hacen falta el alta y la edición`);
    assert.ok(rutas.includes("codigo_repetido"), "sin código de error, la pantalla no puede distinguirlo");
    assert.ok(/409/.test(rutas), "un choque de datos no es un 500");
  });

  // ── 3. El aviso llega al campo ────────────────────────────────────────

  test("EL AVISO SALE PEGADO AL CAMPO DEL CÓDIGO", () => {
    // Y no solo arriba del drawer: el alta tiene diez campos y "ese código
    // ya es de otro alumno" en la cabecera obliga a buscar cuál es.
    const sec = buildDatosSection({ nombre: "Lucía", curso: "1º ESO", codigo: "A-14" });
    const antes = sec.wrap.querySelectorAll(".ac-field-hint--error").length;
    assert.equal(antes, 0, "no puede salir marcado antes de intentar guardar");

    sec.marcarCodigoRepetido(MENSAJE_CODIGO_REPETIDO);
    const hint = sec.wrap.querySelector(".ac-field-hint--error");
    assert.ok(hint, "el aviso no está en ningún sitio del campo");
    assert.equal(hint.textContent, MENSAJE_CODIGO_REPETIDO);
    assert.ok(
      sec.wrap.querySelector("input.ac-input-amber"),
      "el campo tiene que quedar marcado, no solo el texto de debajo",
    );
  });

  test("y las dos clases del aviso existen en el CSS", () => {
    // Una clase que el JS pinta y el CSS no conoce no da error: el aviso
    // sale sin color y pasa desapercibido.
    const css = fs.readFileSync(`${RAIZ}assets/academia/admin/css/_academia-admin.css`, "utf8");
    assert.ok(css.includes(".ac-field-hint--error"), "falta .ac-field-hint--error");
    assert.ok(css.includes(".ac-input-amber"), "falta .ac-input-amber");
  });

  test("leer otra ficha por OCR limpia el aviso de código repetido", () => {
    // El OCR no lee el código —es un dato de la contabilidad, no de la hoja
    // que firma la familia— pero sí reescribe el resto. Dejar el aviso rojo
    // puesto haría pensar que sigue habiendo un choque.
    const sec = buildDatosSection({ nombre: "Lucía", curso: "1º ESO", codigo: "A-14" });
    sec.marcarCodigoRepetido("Ese código ya es de otro alumno.");
    sec.setFromOcr({ nombre: "Lucía Ruiz" });
    assert.equal(sec.wrap.querySelector(".ac-field-hint--error"), null);
    assert.equal(sec.getValue().codigo, "A-14", "y no borra lo escrito");
  });

  test("el código sobrevive a abrir la ficha de un alumno guardado", () => {
    // Si el select del backend no trajera la columna, el campo saldría
    // vacío al reabrir y el siguiente guardado borraría el código.
    const helpers = fs.readFileSync(`${RAIZ}server/lib/academiaAlumnoHelpers.js`, "utf8");
    assert.ok(
      /select\([^)]*\bcodigo\b/s.test(helpers),
      "fetchAlumnoCompleto no pide la columna `codigo`",
    );
    const drawer = fs.readFileSync(`${RAIZ}assets/academia/admin/js/drawer/alumnoDrawer.js`, "utf8");
    assert.ok(/codigo:\s*alumnoActual\?\.codigo/.test(drawer), "el drawer no le pasa el código a la sección");
  });
}
