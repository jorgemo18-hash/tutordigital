import fs from "node:fs";

// El aviso de "Eliminar definitivamente" un alumno.
//
// Decía solo "Esta acción no se puede deshacer": verdad, pero sin informar.
// El borrado se lleva en cascada el diario entero del alumno, sus informes,
// sus notas y su histórico de precios, y el usuario no tenía forma de
// saberlo (auditoría del 08/09/2026).
//
// Las consecuencias que enumera el mensaje están comprobadas contra las
// claves ajenas REALES de producción, no contra las migraciones:
//   CASCADE  → academia_horario, academia_sesiones, academia_recuperaciones,
//              academia_tarifas, academia_pagos, academia_informes,
//              academia_notas_examen, academia_alumno_descuentos,
//              academia_profesor_alumnos
//   SET NULL → academia_recibos_lineas, academia_facturas
export async function run({ test, assert }) {
  const { mensajeEliminarAlumno } = await import(
    "../../assets/academia/admin/js/alumnos/mensajeEliminarAlumno.js"
  );

  test("dice a quién se borra", () => {
    assert.match(mensajeEliminarAlumno("Aarón Val"), /Aarón Val/);
  });

  test("REGRESIÓN: enumera lo que se pierde, no solo que es irreversible", () => {
    const m = mensajeEliminarAlumno("X").toLowerCase();
    for (const cosa of ["diario", "informes", "notas", "pagos", "precios", "ficha"]) {
      assert.ok(m.includes(cosa), `el aviso no menciona: ${cosa}`);
    }
    assert.match(m, /no se puede deshacer/);
  });

  test("y dice también lo que SE CONSERVA", () => {
    // Es la mitad que tranquiliza: los recibos y facturas emitidos no
    // desaparecen (ON DELETE SET NULL), porque son documentos contables que
    // hay que guardar seis años aunque el alumno ya no esté.
    const m = mensajeEliminarAlumno("X").toLowerCase();
    assert.ok(m.includes("recibos"));
    assert.ok(m.includes("factura"));
    assert.ok(m.includes("conservan") || m.includes("conserva"));
  });

  test("REGRESIÓN: los dos sitios que borran usan ESTE mensaje, no uno propio", () => {
    // Estaba escrito dos veces —la fila de la lista y el pie del drawer— y
    // un texto duplicado que enumera consecuencias se desincroniza el día
    // que cambie una regla de borrado.
    for (const archivo of [
      "assets/academia/admin/js/drawer/alumnoDrawerActions.js",
      "assets/academia/admin/js/alumnosListRow.js",
    ]) {
      const src = fs.readFileSync(new URL(`../../${archivo}`, import.meta.url), "utf8");
      assert.match(src, /mensajeEliminarAlumno\(/, `${archivo} no usa el mensaje compartido`);
      assert.equal(
        /Eliminar definitivamente a \$\{/.test(src),
        false,
        `${archivo} vuelve a escribir el aviso a mano`
      );
    }
  });
}
