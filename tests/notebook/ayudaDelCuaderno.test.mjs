import fs from "node:fs";

// El aviso "necesita ayuda" del cuaderno sale de las SESIONES, no de tickets.
//
// EL FALLO (09/09/2026, comprobado contra producción). El contador de cada
// tarjeta se calculaba contando filas de la tabla `tickets`. Ese contador
// estaba muerto: desde que la nota al profesor sustituyó al ticket, NADA en
// la aplicación crea tickets —`onFinished` dejó de hacerlo, y el único otro
// camino (`pushTeacherCTA`) se devuelve y nadie lo llama—. En la base de
// datos solo quedan 32 filas de mayo-junio, de una versión anterior, y las 32
// sin `student_id`, así que ni siquiera esas se contaban.
//
// Resultado: el profesor tenía en su cuaderno un aviso que era imposible de
// encender. Un alumno podía pulsar "No he podido" en todos los ejercicios de
// la semana y la tarjeta seguía en verde.
//
// Ahora sale de `tutor_sessions.needs_help`, que es exactamente lo que marca
// ese botón (ver tests/instituto/notaAlTerminar.test.mjs, que comprueba el
// otro extremo del cable: needs_help=true al decir "No he podido").
export async function run({ test, assert }) {
  const { contarAyudaPorAlumno } = await import("../../server/lib/notebook/resumen.js");

  const ruta = fs.readFileSync(
    new URL("../../server/routes/v1/notebookSummary.routes.js", import.meta.url), "utf8"
  );

  test("REGRESIÓN: el resumen ya no consulta la tabla tickets", () => {
    assert.equal(
      /\.from\(\s*["']tickets["']\s*\)/.test(ruta), false,
      "vuelve a contar tickets: eso es contar algo que nadie crea"
    );
  });

  test("cuenta sesiones marcadas como atascadas, no todas", () => {
    assert.match(ruta, /\.from\(\s*"tutor_sessions"\s*\)/);
    assert.match(
      ruta, /\.eq\(\s*"needs_help"\s*,\s*true\s*\)/,
      "sin este filtro, cualquier sesión normal encendería el aviso"
    );
  });

  test("y solo las del rango pedido", () => {
    // session_date ya es una fecha: se compara tal cual, sin convertir a ISO.
    assert.match(ruta, /\.gte\(\s*"session_date"\s*,\s*from\s*\)/);
    assert.match(ruta, /\.lte\(\s*"session_date"\s*,\s*to\s*\)/);
  });

  test("lo pendiente y lo ya atendido se cuentan por separado", () => {
    const { pendiente, atendida } = contarAyudaPorAlumno([
      { id: "s1", student_id: "a", task_id: "t1", session_date: "2026-09-01", teacher_reviewed: false },
      { id: "s2", student_id: "a", task_id: "t2", session_date: "2026-09-02", teacher_reviewed: true },
    ]);
    assert.equal(pendiente.get("a"), 1);
    assert.equal(atendida.get("a"), 1);
  });

  test("tres intentos con la misma tarea el mismo día son UN aviso", () => {
    // Si contara sesiones, un alumno que insiste parecería tres veces más
    // urgente que uno que se rindió a la primera. Y el profesor solo puede
    // pulsar "revisado" una vez: la unidad tiene que ser la misma que marca
    // PATCH /tutor-sessions/:id/review (alumno + tarea + día).
    const { pendiente } = contarAyudaPorAlumno([
      { id: "s1", student_id: "a", task_id: "t1", session_date: "2026-09-01", teacher_reviewed: false },
      { id: "s2", student_id: "a", task_id: "t1", session_date: "2026-09-01", teacher_reviewed: false },
      { id: "s3", student_id: "a", task_id: "t1", session_date: "2026-09-01", teacher_reviewed: false },
    ]);
    assert.equal(pendiente.get("a"), 1);
  });

  test("pero la misma tarea en dos días distintos son dos", () => {
    const { pendiente } = contarAyudaPorAlumno([
      { id: "s1", student_id: "a", task_id: "t1", session_date: "2026-09-01", teacher_reviewed: false },
      { id: "s2", student_id: "a", task_id: "t1", session_date: "2026-09-02", teacher_reviewed: false },
    ]);
    assert.equal(pendiente.get("a"), 2);
  });

  test("si una sola sesión del grupo sigue sin revisar, el aviso sigue encendido", () => {
    // Y da igual el orden en que la base de datos devuelva las filas: se
    // agrupa primero y se cuenta después, justo para que no dependa de eso.
    const filas = [
      { id: "s1", student_id: "a", task_id: "t1", session_date: "2026-09-01", teacher_reviewed: true },
      { id: "s2", student_id: "a", task_id: "t1", session_date: "2026-09-01", teacher_reviewed: false },
    ];
    for (const orden of [filas, [...filas].reverse()]) {
      const { pendiente, atendida } = contarAyudaPorAlumno(orden);
      assert.equal(pendiente.get("a"), 1, "una sesión sin revisar tiene que mandar");
      assert.equal(atendida.get("a"), undefined);
    }
  });

  test("el chat libre no se agrupa: sin tarea, cada sesión es su propio aviso", () => {
    const { pendiente } = contarAyudaPorAlumno([
      { id: "s1", student_id: "a", task_id: null, session_date: "2026-09-01", teacher_reviewed: false },
      { id: "s2", student_id: "a", task_id: null, session_date: "2026-09-01", teacher_reviewed: false },
    ]);
    assert.equal(pendiente.get("a"), 2, "dos dudas distintas del mismo día no son la misma duda");
  });

  test("una fila sin alumno no cuenta para nadie", () => {
    const { pendiente } = contarAyudaPorAlumno([
      { id: "s1", student_id: null, task_id: "t1", session_date: "2026-09-01" },
    ]);
    assert.equal(pendiente.size, 0);
  });

  test("el semáforo del alumno usa lo pendiente, no lo ya atendido", () => {
    assert.match(
      ruta, /ayudaPendiente:\s*ayuda_pendiente/,
      "si usara el total, la tarjeta se quedaría en rojo para siempre"
    );
  });

  // ── El puente entre despliegues ────────────────────────────────────────
  // El frontend está en Vercel y el backend en Render: no se despliegan a la
  // vez. Sin puente, durante unos minutos el cuaderno de Jorge enseñaría
  // ceros. Los dos lados se cubren, cada uno para el otro.

  test("la API sigue mandando los nombres viejos mientras haya frontend viejo", () => {
    assert.match(ruta, /tickets_open:\s*ayuda_pendiente/);
    assert.match(ruta, /tickets_closed:\s*ayuda_atendida/);
  });

  test("y el frontend nuevo entiende una API vieja", () => {
    const front = fs.readFileSync(
      new URL("../../assets/teacher/js/notebook.js", import.meta.url), "utf8"
    );
    assert.match(front, /ayuda_pendiente:\s*s\.ayuda_pendiente\s*\?\?\s*s\.tickets_open/);
    assert.match(front, /ayuda_atendida:\s*s\.ayuda_atendida\s*\?\?\s*s\.tickets_closed/);
  });

  test("la tarjeta lee el nombre nuevo", () => {
    const cards = fs.readFileSync(
      new URL("../../assets/teacher/js/notebook-cards.js", import.meta.url), "utf8"
    );
    assert.match(cards, /needs:\s*asCount\(summaryMatch\?\.ayuda_pendiente\)/);
  });
}
