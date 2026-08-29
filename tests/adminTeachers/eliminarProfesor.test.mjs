// Quitar a un profesor de la plantilla: dos acciones distintas.
//
// Dar de baja (is_active=false) conserva el rastro — diario, horario,
// fichajes, informes siguen diciendo quién los hizo. Eliminar borra la
// ficha, y eso solo tiene sentido para un error (una ficha duplicada o
// creada por equivocación).
//
// El peligro concreto: `academia_sesiones.profesor_id` y
// `academia_horario.profesor_id` son ON DELETE SET NULL. Borrar a alguien
// que ya ha dado clase NO da error: deja el diario y el horario del centro
// apuntando al vacío, en silencio. Por eso se comprueba antes y, si hay
// rastro, se dice cuál.
export async function run({ test, assert }) {
  const { motivosQueImpidenEliminar, eliminarProfesor } = await import(
    "../../server/lib/adminTeachers/eliminarProfesor.js"
  );

  // Fake de conteo: cada .from(tabla) devuelve el número que le toque a esa
  // tabla+filtros, y registra lo que se ha preguntado.
  function adminFalso(conteos = {}, { errorEn = null } = {}) {
    const registro = { consultas: [], borrados: [] };
    return {
      registro,
      from(tabla) {
        const filtros = {};
        const builder = {
          select() { return builder; },
          eq(col, val) { filtros[col] = val; return builder; },
          delete() { builder._delete = true; return builder; },
          then(resolve) {
            if (builder._delete) {
              registro.borrados.push({ tabla, filtros });
              return Promise.resolve({ error: errorEn === tabla ? new Error("db") : null }).then(resolve);
            }
            registro.consultas.push({ tabla, filtros });
            if (errorEn === tabla) return Promise.resolve({ count: null, error: new Error("db") }).then(resolve);
            const clave = `${tabla}:${filtros.profesor_id || filtros.profesor_sustituto_id || filtros.profesor_sustituido_id || filtros.worker_profile_id}`;
            return Promise.resolve({ count: conteos[clave] ?? conteos[tabla] ?? 0, error: null }).then(resolve);
          },
        };
        return builder;
      },
    };
  }

  const PROFE = { id: "p1", user_id: "u1", email: "profe@demo.com" };
  const CTX = { profile: PROFE, tenantId: "t1" };

  test("un profesor sin rastro se puede eliminar", async () => {
    const { motivos } = await motivosQueImpidenEliminar(adminFalso(), CTX);
    assert.deepEqual(motivos, []);
  });

  test("REGRESIÓN: con clases en el diario NO se puede — se dice cuántas", async () => {
    // Sin esta comprobación el borrado pasaría sin error y dejaría esas
    // sesiones con profesor_id = NULL.
    const { motivos } = await motivosQueImpidenEliminar(adminFalso({ academia_sesiones: 12 }), CTX);
    assert.equal(motivos.length, 1);
    assert.ok(/12 clases en el diario/.test(motivos[0]), motivos[0]);
  });

  test("con franjas del horario a su nombre tampoco", async () => {
    const { motivos } = await motivosQueImpidenEliminar(adminFalso({ academia_horario: 1 }), CTX);
    assert.ok(/imparte 1 franja/.test(motivos[0]), motivos[0]);
  });

  test("con alumnos asignados tampoco", async () => {
    const { motivos } = await motivosQueImpidenEliminar(adminFalso({ academia_profesor_alumnos: 3 }), CTX);
    assert.ok(/3 alumnos asignados/.test(motivos[0]), motivos[0]);
  });

  test("los fichajes se buscan por la CUENTA, no por la ficha de profesor", async () => {
    // academia_fichajes.worker_profile_id apunta a profiles(id), no a
    // teacher_profiles. Buscarlo por profesor_id daría siempre cero y
    // dejaría borrar a alguien con registro de jornada.
    const admin = adminFalso({ "academia_fichajes:u1": 40 });
    const { motivos } = await motivosQueImpidenEliminar(admin, CTX);
    assert.ok(motivos.some((m) => /40 fichajes/.test(m)), JSON.stringify(motivos));
    const consultaFichajes = admin.registro.consultas.find((c) => c.tabla === "academia_fichajes");
    assert.equal(consultaFichajes.filtros.worker_profile_id, "u1");
  });

  test("una ficha sin cuenta (invitación nunca aceptada) no consulta fichajes", async () => {
    const admin = adminFalso();
    await motivosQueImpidenEliminar(admin, { profile: { id: "p2", user_id: null }, tenantId: "t1" });
    assert.equal(admin.registro.consultas.some((c) => c.tabla === "academia_fichajes"), false);
  });

  test("se acumulan TODOS los motivos, no solo el primero", async () => {
    // Enseñar solo uno obliga al admin a descubrirlos de uno en uno.
    const { motivos } = await motivosQueImpidenEliminar(
      adminFalso({ academia_sesiones: 5, academia_horario: 2, academia_profesor_alumnos: 1 }), CTX
    );
    assert.equal(motivos.length, 3);
  });

  test("un error de base de datos NO se lee como 'no hay rastro'", async () => {
    // Tratarlo como cero sería borrar por no haber podido comprobar.
    const { error, motivos } = await motivosQueImpidenEliminar(
      adminFalso({}, { errorEn: "academia_sesiones" }), CTX
    );
    assert.ok(error, "tiene que propagar el error");
    assert.equal(motivos, undefined);
  });

  test("al eliminar se borra la ficha y se le quita la membresía de PROFESOR", async () => {
    const admin = adminFalso();
    await eliminarProfesor(admin, CTX);
    const membresia = admin.registro.borrados.find((b) => b.tabla === "tenant_memberships");
    assert.ok(membresia, "se le saca del centro");
    assert.equal(membresia.filtros.role, "teacher",
      "SOLO la de profesor: quitarle la de admin le dejaría fuera de su propia academia");
    assert.equal(membresia.filtros.tenant_id, "t1");
    assert.ok(admin.registro.borrados.some((b) => b.tabla === "teacher_profiles"));
  });

  test("una ficha sin cuenta no toca tenant_memberships", async () => {
    const admin = adminFalso();
    await eliminarProfesor(admin, { profile: { id: "p2", user_id: null }, tenantId: "t1" });
    assert.equal(admin.registro.borrados.some((b) => b.tabla === "tenant_memberships"), false);
  });

  test("si falla quitar la membresía, no se borra la ficha", async () => {
    // Quedaría una persona con acceso de profesor al centro y sin ficha.
    const admin = adminFalso({}, { errorEn: "tenant_memberships" });
    const { error } = await eliminarProfesor(admin, CTX);
    assert.ok(error);
    assert.equal(admin.registro.borrados.some((b) => b.tabla === "teacher_profiles"), false);
  });
}
