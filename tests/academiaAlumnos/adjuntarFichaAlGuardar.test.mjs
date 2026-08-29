import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// El ORDEN de la subida de la ficha: primero se crea el alumno, luego se le
// adjunta la foto contra su id REAL.
//
// Al revés —subir primero con un id inventado— es lo que ya pasó con las
// facturas de gastos: el archivo quedaba en Storage bajo un id que no
// correspondía a ninguna fila, el UPDATE no afectaba a nada y no daba error,
// así que ni se notaba. Aquí se prueba el orden explícitamente.
export async function run({ test, assert }) {
  const { createAlumnoDrawerActions } = await import(
    "../../assets/academia/admin/js/drawer/alumnoDrawerActions.js"
  );

  function seccionesFalsas() {
    return {
      datos: { getValue: () => ({ nombre: "Alejandra Ferrer", curso: "4º PRIM", email: "a@demo.com" }) },
      tarifa: { getValue: () => ({ precio_bruto: 100 }) },
      familia: { getValue: () => ({ familia_id: "fam-1" }), showError: () => {}, wrap: { scrollIntoView: () => {} } },
      horario: { getValue: () => [] },
    };
  }

  function montar({ archivo = { base64: "YmFzZTY0", mime: "image/jpeg" }, uploadFichaAlumnoFn, createAlumnoFn } = {}) {
    const eventos = [];
    const acciones = createAlumnoDrawerActions({
      getSections: seccionesFalsas,
      getAlumnoActual: () => null,
      onSaved: () => eventos.push("onSaved"),
      close: () => eventos.push("close"),
      getFichaArchivo: () => archivo,
      createAlumnoFn: createAlumnoFn || (async () => {
        eventos.push("createAlumno");
        return { alumno: { id: "alumno-nuevo-1", nombre: "Alejandra Ferrer" } };
      }),
      uploadFichaAlumnoFn: uploadFichaAlumnoFn || (async (id, adj) => {
        eventos.push(`upload:${id}:${adj.mime}`);
        return "https://cdn.test/ficha.jpg";
      }),
    });
    return { acciones, eventos };
  }

  const msgFalso = () => ({ textContent: "", className: "" });
  const btnFalso = () => ({ disabled: false });

  test("alta completa: se crea el alumno y DESPUÉS se sube la ficha con su id real", async () => {
    const { acciones, eventos } = montar();
    await acciones.guardarNuevo(msgFalso(), btnFalso());
    assert.deepEqual(
      eventos.filter((e) => e === "createAlumno" || e.startsWith("upload:")),
      ["createAlumno", "upload:alumno-nuevo-1:image/jpeg"]
    );
  });

  test("borrador: también guarda la ficha — es lo único fiable que hay todavía", async () => {
    // Se guarda en borrador justo cuando faltan horario, tarifa o familia.
    // La hoja en papel es entonces el documento de referencia.
    const { acciones, eventos } = montar();
    await acciones.guardarBorrador(msgFalso(), btnFalso());
    assert.ok(eventos.some((e) => e === "upload:alumno-nuevo-1:image/jpeg"));
  });

  test("sin ficha elegida no se llama a la subida", async () => {
    const { acciones, eventos } = montar({ archivo: null });
    await acciones.guardarNuevo(msgFalso(), btnFalso());
    assert.equal(eventos.some((e) => e.startsWith("upload:")), false);
  });

  test("si la subida de la ficha falla, el alumno queda creado igual", async () => {
    // Perder un alta porque no se pudo guardar una imagen sería el peor
    // intercambio posible: los datos ya están, la foto se puede subir luego
    // desde la ficha del alumno.
    const { acciones, eventos } = montar({
      uploadFichaAlumnoFn: async () => { throw new Error("bucket caído"); },
    });
    await acciones.guardarNuevo(msgFalso(), btnFalso());
    assert.ok(eventos.includes("onSaved"), "el alta se da por buena");
    assert.ok(eventos.includes("close"), "y el drawer se cierra");
  });

  test("si falla la creación del alumno, no se sube ninguna ficha", async () => {
    // No hay id contra el que subirla — sería otro archivo huérfano.
    const { acciones, eventos } = montar({
      createAlumnoFn: async () => { throw new Error("email duplicado"); },
    });
    await acciones.guardarNuevo(msgFalso(), btnFalso());
    assert.equal(eventos.some((e) => e.startsWith("upload:")), false);
    assert.equal(eventos.includes("onSaved"), false);
  });
}
