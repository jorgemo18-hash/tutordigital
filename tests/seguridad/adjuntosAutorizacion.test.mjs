import fs from "node:fs";

const RAIZ = new URL("../../", import.meta.url).pathname;

// QUIÉN PUEDE ABRIR UN ADJUNTO.
//
// EL AGUJERO (verificado leyendo el código el 11/09/2026).
// `GET /api/v1/attachments/:id/signed-url` comprobaba dos cosas: que
// tuvieras un rol del centro y que el adjunto fuera del mismo tenant. Con el
// id de un adjunto, **cualquier alumno se descargaba cualquier archivo del
// centro**, la foto del cuaderno de un compañero incluida. El `DELETE`
// igual: profesor o admin, sin mirar de qué grupo.
//
// Lo único que lo tapaba era que los ids son UUID aleatorios — seguridad por
// que nadie adivine el número. Y la URL firmada dura SIETE DÍAS: una vez
// conseguida, quitarle el acceso al usuario no la cierra.
//
// EL CASO QUE DE VERDAD IMPORTA, y el que obliga a la segunda condición del
// alumno: en una tarea de GRUPO, dos alumnos suben cada uno la foto de su
// cuaderno. Los dos pasan "esta tarea es mía". Con solo eso, cada uno se
// descarga el cuaderno del otro.
export async function run({ test, assert }) {
  const { autorizarAdjunto } = await import("../../server/lib/attachments/autorizarAdjunto.js");

  const TENANT = "t1";
  const SLUG = "centro-x";

  // Fake mínimo con el encadenamiento que usan los helpers de verdad
  // (select/eq/in/maybeSingle, y `then` para las consultas de lista).
  function fakeAdmin({ tareas = [], grupos = [], alumnos = [], alumnoDelUsuario = null, fallo = null } = {}) {
    const tabla = (nombre) => {
      const q = {
        _f: {},
        select() { return q; },
        eq(col, val) { q._f[col] = val; return q; },
        in(col, vals) { q._f[col] = vals; return q; },
        maybeSingle() {
          if (fallo === nombre) return Promise.resolve({ data: null, error: { message: "boom" } });
          if (nombre === "tasks") {
            return Promise.resolve({ data: tareas.find((t) => t.id === q._f.id) || null, error: null });
          }
          if (nombre === "teacher_profiles") {
            return Promise.resolve({ data: { id: "tp1" }, error: null });
          }
          if (nombre === "students") {
            return Promise.resolve({ data: alumnoDelUsuario, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve) {
          if (fallo === nombre) return resolve({ data: null, error: { message: "boom" } });
          if (nombre === "teacher_groups") return resolve({ data: grupos, error: null });
          if (nombre === "students") {
            const permitidos = q._f.group_id || [];
            return resolve({ data: alumnos.filter((a) => permitidos.includes(a.group_id)), error: null });
          }
          return resolve({ data: [], error: null });
        },
      };
      return q;
    };
    return { from: tabla };
  }

  const PROFE = "u-profe";
  const ANA = "u-ana";
  const LUIS = "u-luis";

  // Una tarea de grupo de 3ºB, con su profesor.
  const TAREA_GRUPO = { id: "task-1", group_id: "g1", student_id: null, teacher_id: PROFE };
  // Y una de otro grupo, que no es de ese profesor.
  const TAREA_OTRO_GRUPO = { id: "task-9", group_id: "g9", student_id: null, teacher_id: "u-otro" };
  // Sesión libre: sin grupo, atada a un alumno.
  const TAREA_LIBRE = { id: "task-libre", group_id: null, student_id: "a-ana", teacher_id: null };

  const MUNDO = {
    tareas: [TAREA_GRUPO, TAREA_OTRO_GRUPO, TAREA_LIBRE],
    grupos: [{ group_id: "g1" }],
    alumnos: [{ id: "a-ana", group_id: "g1" }, { id: "a-luis", group_id: "g1" }],
  };

  const adj = (extra) => ({ id: "att-1", owner_type: "task", owner_id: "task-1", ...extra });
  const base = { tenantId: TENANT, tenantSlug: SLUG, email: "quien@sea.es" };

  // ── El caso del compañero ─────────────────────────────────────────────

  test("AGUJERO CERRADO: un alumno NO abre la foto del cuaderno de un compañero", async () => {
    // Ana y Luis están en el mismo grupo y la tarea es de los dos. Luis
    // subió su foto; Ana pide su id.
    const permiso = await autorizarAdjunto(
      fakeAdmin({ ...MUNDO, alumnoDelUsuario: { id: "a-ana", group_id: "g1" } }),
      { ...base, role: "student", userId: ANA, adjunto: adj({ uploader_id: LUIS }) }
    );
    assert.equal(permiso.ok, false);
    assert.equal(permiso.code, "adjunto_no_visible");
  });

  test("pero SÍ abre la suya propia", async () => {
    const permiso = await autorizarAdjunto(
      fakeAdmin({ ...MUNDO, alumnoDelUsuario: { id: "a-ana", group_id: "g1" } }),
      { ...base, role: "student", userId: ANA, adjunto: adj({ uploader_id: ANA }) }
    );
    assert.equal(permiso.ok, true);
  });

  test("y SÍ el enunciado que subió su profesor — si no, la tarea no se puede hacer", async () => {
    const permiso = await autorizarAdjunto(
      fakeAdmin({ ...MUNDO, alumnoDelUsuario: { id: "a-ana", group_id: "g1" } }),
      { ...base, role: "student", userId: ANA, adjunto: adj({ uploader_id: PROFE }) }
    );
    assert.equal(permiso.ok, true);
  });

  test("un alumno de OTRO grupo no abre nada de esa tarea", async () => {
    const permiso = await autorizarAdjunto(
      fakeAdmin({ ...MUNDO, alumnoDelUsuario: { id: "a-zoe", group_id: "g9" } }),
      { ...base, role: "student", userId: "u-zoe", adjunto: adj({ uploader_id: PROFE }) }
    );
    assert.equal(permiso.ok, false);
  });

  test("un usuario con rol alumno que no tiene ficha de alumno no abre nada", async () => {
    const permiso = await autorizarAdjunto(
      fakeAdmin({ ...MUNDO, alumnoDelUsuario: null }),
      { ...base, role: "student", userId: "u-fantasma", adjunto: adj({ uploader_id: PROFE }) }
    );
    assert.equal(permiso.ok, false);
  });

  // ── El profesor ───────────────────────────────────────────────────────

  test("el profesor abre los adjuntos de SU grupo", async () => {
    const permiso = await autorizarAdjunto(fakeAdmin(MUNDO), {
      ...base, role: "teacher", userId: PROFE, adjunto: adj({ uploader_id: PROFE }),
    });
    assert.equal(permiso.ok, true);
  });

  test("AGUJERO CERRADO: y NO los de un grupo que no es suyo", async () => {
    const permiso = await autorizarAdjunto(fakeAdmin(MUNDO), {
      ...base, role: "teacher", userId: PROFE,
      adjunto: adj({ owner_id: "task-9", uploader_id: "u-otro" }),
    });
    assert.equal(permiso.ok, false);
  });

  test("un profesor SIN grupos no abre nada, no lo abre todo", async () => {
    // El antipatrón de siempre: "sin grupos" no puede caer a "sin filtro".
    const permiso = await autorizarAdjunto(fakeAdmin({ ...MUNDO, grupos: [] }), {
      ...base, role: "teacher", userId: PROFE, adjunto: adj({ uploader_id: PROFE }),
    });
    assert.equal(permiso.ok, false);
  });

  test("tarea sin grupo (sesión libre): se comprueba el ALUMNO, no el grupo", async () => {
    const dentro = await autorizarAdjunto(fakeAdmin(MUNDO), {
      ...base, role: "teacher", userId: PROFE,
      adjunto: adj({ owner_id: "task-libre", uploader_id: ANA }),
    });
    assert.equal(dentro.ok, true, "Ana es alumna de su grupo g1");

    const fuera = await autorizarAdjunto(
      fakeAdmin({ ...MUNDO, alumnos: [{ id: "a-ana", group_id: "g9" }] }),
      { ...base, role: "teacher", userId: PROFE, adjunto: adj({ owner_id: "task-libre", uploader_id: ANA }) }
    );
    assert.equal(fuera.ok, false, "si Ana no es de sus grupos, no");
  });

  // ── El admin ──────────────────────────────────────────────────────────

  test("al admin le basta el tenant: es su centro", async () => {
    const permiso = await autorizarAdjunto(fakeAdmin(MUNDO), {
      ...base, role: "admin", userId: "u-admin", adjunto: adj({ owner_id: "task-9", uploader_id: "u-otro" }),
    });
    assert.equal(permiso.ok, true);
  });

  // ── Los bordes, que son donde esto se cae ─────────────────────────────

  test("TAREA BORRADA: solo el admin — en producción hay 34 adjuntos así", async () => {
    // Fotos de cuaderno de las sesiones de mayo-junio de Lyceo cuyas tareas
    // ya no existen (11,8 MB en Storage): borrar una tarea no se lleva sus
    // adjuntos. Sin tarea no hay grupo ni alumno contra los que comprobar
    // nada, así que nadie puede quedar autorizado por esa vía; al admin se
    // le deja porque son archivos de su centro y es quien puede limpiarlos.
    const huerfano = adj({ owner_id: "task-borrada", uploader_id: ANA });
    for (const [role, userId] of [["teacher", PROFE], ["student", ANA]]) {
      const permiso = await autorizarAdjunto(
        fakeAdmin({ ...MUNDO, alumnoDelUsuario: { id: "a-ana", group_id: "g1" } }),
        { ...base, role, userId, adjunto: huerfano }
      );
      assert.equal(permiso.ok, false, `${role} no debería poder`);
    }
    const admin = await autorizarAdjunto(fakeAdmin(MUNDO), {
      ...base, role: "admin", userId: "u-admin", adjunto: huerfano,
    });
    assert.equal(admin.ok, true);
  });

  test("un owner_type sin regla se DENIEGA, no se deja pasar", async () => {
    // Hoy solo se escribe "task". El día que alguien cuelgue adjuntos de
    // otra cosa, esto tiene que romper y no abrirse.
    const permiso = await autorizarAdjunto(fakeAdmin(MUNDO), {
      ...base, role: "student", userId: ANA,
      adjunto: { id: "att-x", owner_type: "informe", owner_id: "algo", uploader_id: ANA },
    });
    assert.equal(permiso.ok, false);
    assert.equal(permiso.code, "owner_type_sin_regla");
  });

  test("REGRESIÓN: un error de base de datos NO es un sí", async () => {
    // El fallo que ya costó el aislamiento de GET /api/v1/tasks: un helper
    // que devolvía "sin filtro" al fallar la consulta abría el centro entero
    // con un hipo transitorio de Supabase.
    const permiso = await autorizarAdjunto(fakeAdmin({ ...MUNDO, fallo: "tasks" }), {
      ...base, role: "student", userId: ANA, adjunto: adj({ uploader_id: ANA }),
    });
    assert.equal(permiso.ok, false);
    assert.equal(permiso.code, "visibilidad_fetch_failed", "y se distingue, porque la ruta responde 500");
  });

  test("un rol desconocido no tiene regla: se deniega", async () => {
    const permiso = await autorizarAdjunto(fakeAdmin(MUNDO), {
      ...base, role: "superadmin", userId: "u-x", adjunto: adj({ uploader_id: PROFE }),
    });
    assert.equal(permiso.ok, false);
  });

  test("sin adjunto no hay nada que autorizar", async () => {
    const permiso = await autorizarAdjunto(fakeAdmin(MUNDO), {
      ...base, role: "admin", userId: "u-admin", adjunto: null,
    });
    assert.equal(permiso.ok, false);
  });

  // ── Que las rutas lo llamen de verdad ─────────────────────────────────

  const RUTA = fs.readFileSync(`${RAIZ}server/routes/v1/attachments.routes.js`, "utf8");

  test("REGRESIÓN: las DOS rutas pasan por la autorización", async () => {
    // Es el fallo de verdad: el helper puede estar perfecto y la ruta no
    // llamarlo. Aquí estaba el agujero, no en la lógica.
    assert.equal(
      (RUTA.match(/await autorizarAdjunto\(/g) || []).length, 2,
      "signed-url y delete"
    );
  });

  test("REGRESIÓN: el SELECT trae las columnas que deciden de quién es", async () => {
    // La forma exacta de los cuatro fallos de este mes: una columna que no
    // se pide llega como undefined, y undefined se lee como un valor
    // legítimo. Sin owner_id no hay tarea que mirar y todo el mundo pasaría.
    const selects = RUTA.match(/\.select\("id, storage_path[^"]*"\)/g) || [];
    assert.equal(selects.length, 2);
    for (const s of selects) {
      assert.match(s, /owner_type/);
      assert.match(s, /owner_id/);
      assert.match(s, /uploader_id/);
    }
  });

  test("REGRESIÓN: denegar responde 404, no 403", async () => {
    // Un 403 confirma que ese id existe — justo lo que no hay que regalarle
    // a quien está probando ids. Mismo criterio que tutor-sessions.
    //
    // Se miran los DOS bloques `if (!permiso.ok)`, no el archivo entero: el
    // POST sí devuelve un 403 legítimo ("no puedes adjuntar a esta tarea"),
    // que es otra pregunta y otra respuesta.
    const bloques = RUTA.split("if (!permiso.ok)").slice(1);
    assert.equal(bloques.length, 2, "un bloque por ruta");
    for (const bloque of bloques) {
      // Se leen los CÓDIGOS que devuelve el bloque, no su texto: la primera
      // versión de este test buscaba "403" en el bloque y se disparaba con
      // el comentario que explica por qué NO se usa un 403. Un test que lee
      // prosa comprueba prosa.
      const codigos = [...bloque.slice(0, 600).matchAll(/return fail\(reply, (\d{3}),/g)].map((m) => m[1]);
      assert.deepEqual(codigos, ["500", "404"], "primero el 500 del error de BD, luego el 404 de denegado");
      assert.match(bloque.slice(0, 600), /permiso\.code === "visibilidad_fetch_failed"/);
    }
  });

  test("el listado de tareas sigue filtrando por quién subió cada cosa", async () => {
    // La otra mitad de la misma regla, que ya existía: attachAttachments
    // solo enseña lo que subió el profesor de la tarea. Si alguien la quita,
    // el listado volvería a enseñar los cuadernos de los compañeros aunque
    // signed-url los deniegue.
    const helpers = fs.readFileSync(`${RAIZ}server/lib/tasksHelpers.js`, "utf8");
    assert.match(helpers, /if \(teacherId && att\.uploader_id !== teacherId\) return;/);
  });
}
