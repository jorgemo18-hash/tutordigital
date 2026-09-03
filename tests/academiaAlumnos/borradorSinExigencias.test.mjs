import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// UN BORRADOR NO EXIGE NADA MÁS QUE NOMBRE Y CURSO.
//
// Jorge, 03/09, con el caso delante: "me ha escrito una madre, ya sé que va
// a venir y los días, pero no tengo sus datos; pongo lo que sé y lo guardo
// en borrador hasta que me den la ficha — y no me deja porque no he creado
// la familia".
//
// Lo que obliga a tener familia es el ESTADO ACTIVO, no el botón: de un
// alumno activo salen recibos e informes y ahí sí hace falta. Un borrador
// es "lo que sé por ahora", y bloquearlo obliga a inventarse una familia
// vacía o a apuntarlo en un papel — justo lo que la app viene a quitar.
export async function run({ test, assert }) {
  const { createAlumnoDrawerActions } = await import(
    "../../assets/academia/admin/js/drawer/alumnoDrawerActions.js"
  );
  const { buildFootEditar } = await import(
    "../../assets/academia/admin/js/drawer/alumnoDrawerFoot.js"
  );

  const HORARIO = [{ dia_semana: 2, hora_inicio: "16:30", hora_fin: "17:30" }];

  // Lo que hay en pantalla cuando solo se sabe el nombre, el curso y los
  // días: sin familia elegida, sin email, sin tarifa.
  function seccionesAMedias({ familiaId = null } = {}) {
    const errores = [];
    return {
      errores,
      sections: {
        datos: { getValue: () => ({ nombre: "Marta Gil", curso: "1º ESO" }) },
        tarifa: { getValue: () => ({}) },
        familia: {
          getValue: () => ({ familia_id: familiaId }),
          showError: (t) => errores.push(t),
          wrap: { scrollIntoView: () => {} },
        },
        horario: { getValue: () => HORARIO },
      },
    };
  }

  function montar({ familiaId = null, alumnoActual = null, accesoTutorActivo = false } = {}) {
    const { sections, errores } = seccionesAMedias({ familiaId });
    const enviados = [];
    const acciones = createAlumnoDrawerActions({
      getSections: () => sections,
      getAlumnoActual: () => alumnoActual,
      onSaved: () => enviados.push({ tipo: "onSaved" }),
      close: () => enviados.push({ tipo: "close" }),
      accesoTutorActivo,
      createAlumnoFn: async (payload) => {
        enviados.push({ tipo: "create", payload });
        return { alumno: { id: "nuevo-1", nombre: payload.nombre } };
      },
    });
    return { acciones, enviados, errores };
  }

  const msgFalso = () => ({ textContent: "", className: "" });
  const btnFalso = () => ({ disabled: false });

  // ── Crear el borrador ─────────────────────────────────────────────────

  test("REGRESIÓN: se guarda el borrador SIN familia, sin errores", async () => {
    const { acciones, enviados, errores } = montar();
    await acciones.guardarBorrador(msgFalso(), btnFalso());
    assert.deepEqual(errores, [], "no se pide familia");
    const create = enviados.find((e) => e.tipo === "create");
    assert.ok(create, "el alumno se crea");
    assert.equal(create.payload.activo, false, "y queda en Borradores");
  });

  test("el borrador se lleva los días que YA se saben", async () => {
    // Era lo que se perdía: el horario recién marcado no viajaba, y había
    // que volver a marcarlo entero después. Un borrador que pierde datos no
    // se usa.
    const { acciones, enviados } = montar();
    await acciones.guardarBorrador(msgFalso(), btnFalso());
    assert.deepEqual(enviados.find((e) => e.tipo === "create").payload.horario, HORARIO);
  });

  test("y también la familia y la tarifa si resulta que sí las hay", async () => {
    const { acciones, enviados } = montar({ familiaId: "fam-1" });
    await acciones.guardarBorrador(msgFalso(), btnFalso());
    assert.equal(enviados.find((e) => e.tipo === "create").payload.familia_id, "fam-1");
  });

  test("nombre y curso sí se siguen exigiendo: un borrador sin nombre no es nada", async () => {
    const { sections } = seccionesAMedias();
    sections.datos.getValue = () => ({ nombre: "", curso: "" });
    const enviados = [];
    const acciones = createAlumnoDrawerActions({
      getSections: () => sections,
      getAlumnoActual: () => null,
      onSaved: () => {}, close: () => {},
      createAlumnoFn: async () => { enviados.push("create"); return { alumno: { id: "x" } }; },
    });
    const msg = msgFalso();
    await acciones.guardarBorrador(msg, btnFalso());
    assert.deepEqual(enviados, []);
    assert.match(msg.textContent, /Nombre y curso/);
  });

  test("REGRESIÓN: el alta ACTIVA sigue exigiendo familia", async () => {
    // La exigencia no se ha quitado, se ha movido al estado que la necesita.
    const { acciones, enviados, errores } = montar();
    await acciones.guardarNuevo(msgFalso(), btnFalso());
    assert.deepEqual(enviados, [], "no se crea nada");
    assert.deepEqual(errores, ["Es obligatorio asignar una familia"]);
  });

  // ── Volver a abrir el borrador para añadirle cosas ────────────────────

  const BORRADOR = { id: "b1", nombre: "Marta Gil", activo: false, fecha_baja: null };
  const ARCHIVADO = { id: "a1", nombre: "Luis", activo: false, fecha_baja: "2026-06-30" };

  test("REGRESIÓN: guardar un borrador ya creado tampoco exige familia", async () => {
    // Es el caso de verdad: se abre para apuntar los días que acaba de
    // decir la madre, y no hay por qué tener la familia todavía.
    const { sections, errores } = seccionesAMedias();
    const llamadas = [];
    const acciones = createAlumnoDrawerActions({
      getSections: () => sections,
      getAlumnoActual: () => BORRADOR,
      onSaved: () => llamadas.push("onSaved"),
      close: () => llamadas.push("close"),
      updateAlumnoFn: async () => ({ id: "b1" }),
    });
    // updateAlumno/updateHorarioAlumno no son inyectables: se comprueba que
    // NO se corta en la validación, que es lo que fallaba. Si llega a la
    // llamada real, revienta por red y no por familia.
    const msg = msgFalso();
    await acciones.guardarCambios(msg, btnFalso());
    assert.deepEqual(errores, [], "no se pide familia");
    assert.equal(/familia/i.test(msg.textContent), false, msg.textContent);
  });

  // ── El pie del drawer ─────────────────────────────────────────────────

  const textos = (raiz) => [...raiz.querySelectorAll("button")].map((b) => b.textContent);

  function pie(alumnoActual) {
    const cont = document.createElement("div");
    cont.appendChild(buildFootEditar(document.createElement("div"), {
      alumnoActual,
      onCancelar: () => {}, onGuardar: () => {}, onArchivar: () => {},
      onRestaurar: () => {}, onEliminarDefinitivo: () => {}, onDarDeAlta: () => {},
    }));
    return cont;
  }

  test("REGRESIÓN: a un borrador ya no se le ofrece 'Restaurar' ni 'Eliminar definitivamente'", () => {
    // Borrador y archivado son los dos `activo:false` y NO son lo mismo: uno
    // no ha empezado y el otro se fue. El pie los trataba igual.
    assert.deepEqual(textos(pie(BORRADOR)), ["Cancelar", "Dar de alta", "Guardar borrador"]);
  });

  test("un alumno archivado conserva su pie de siempre", () => {
    const t = textos(pie(ARCHIVADO));
    assert.ok(t.includes("Restaurar"));
    assert.ok(t.includes("Eliminar definitivamente"));
    assert.equal(t.includes("Dar de alta"), false);
  });

  test("un alumno activo conserva su pie de siempre", () => {
    assert.deepEqual(textos(pie({ id: "x", nombre: "Ana", activo: true })), ["Cancelar", "Archivar", "Guardar"]);
  });

  test("'Dar de alta' SÍ exige familia: es lo que lo convierte en alumno de verdad", async () => {
    const { acciones, enviados, errores } = montar({ alumnoActual: BORRADOR });
    await acciones.darDeAlta(msgFalso(), btnFalso());
    assert.deepEqual(errores, ["Es obligatorio asignar una familia"]);
    assert.deepEqual(enviados, [], "no se activa a medias");
  });

  test("'Dar de alta' con el tutor encendido exige además el email del alumno", async () => {
    const { acciones, errores } = montar({
      alumnoActual: BORRADOR, familiaId: "fam-1", accesoTutorActivo: true,
    });
    const msg = msgFalso();
    await acciones.darDeAlta(msg, btnFalso());
    assert.deepEqual(errores, [], "la familia ya está");
    assert.match(msg.textContent, /email del alumno es obligatorio/);
  });
}
