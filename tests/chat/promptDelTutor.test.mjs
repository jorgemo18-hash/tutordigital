// EL PROMPT DEL TUTOR: lo que no puede perder nunca, y con quién habla.
//
// No prueba cómo contesta el modelo (eso necesita la IA de verdad): fija que
// las reglas que hacen que el tutor NO dé la respuesta siguen escritas, para
// que un retoque bienintencionado del prompt no las borre sin que se note.
export async function run({ test, assert }) {
  const { buildTutorInstructions } = await import("../../server/lib/chatPrompt.js");
  const { fetchContextoDelAlumno, nivelDelGrupo } = await import("../../server/lib/orchestrator/contextoDelAlumno.js");

  const MAPA = { steps: [{ index: 0, title: "Aislar la x", completed: false }], currentStep: 0 };
  const prompt = buildTutorInstructions("deberes", null, 0,
    { alumno_nombre: "Nora", nivel_educativo: "1.º de ESO", asignatura: "Matemáticas" }, MAPA, "2x + 5 = 9");

  test("lo innegociable sigue escrito: no dar la respuesta, una pregunta, respuestas cortas", () => {
    assert.match(prompt, /Nunca das la respuesta directa/);
    assert.match(prompt, /Una sola pregunta por respuesta\. Nunca dos\./);
    assert.match(prompt, /Máximo 3-4 líneas/);
    assert.match(prompt, /Nunca expliques la regla ni des la operación correcta/);
    assert.match(prompt, /nunca regales la respuesta para animarle/);
  });

  test("LearnLM: primero su razonamiento, después la corrección", () => {
    assert.match(prompt, /PRIMERO SU RAZONAMIENTO, DESPUÉS TU CORRECCIÓN/);
    assert.match(prompt, /pídele que te cuente cómo lo ha pensado/);
    assert.match(prompt, /no se lo vuelvas a pedir/);
  });

  test("estructura PARTS, y el enunciado y el mapa de pasos van dentro", () => {
    const orden = ["QUIÉN ERES", "QUÉ HACES", "CON QUIÉN HABLAS", "SOBRE QUÉ", "CÓMO RESPONDES", "MAPA DE PROGRESO"].map((t) => prompt.indexOf(t));
    assert.ok(orden.every((i) => i >= 0), "falta alguna sección");
    assert.deepEqual([...orden].sort((a, b) => a - b), orden, "en ese orden");
    assert.match(prompt, /2x \+ 5 = 9/);
    assert.match(prompt, /\[PASO_COMPLETADO\] va SIEMPRE al final/);
  });

  test("REGRESIÓN: el nivel ya no es el modo ('Nivel: deberes')", () => {
    assert.match(prompt, /- Nivel: 1\.º de ESO/);
    assert.match(prompt, /- Asignatura: Matemáticas/);
    const sin = buildTutorInstructions("deberes", null, 0, null, null);
    assert.match(sin, /- Nivel: no especificado/);
    assert.equal(/Nivel: deberes/i.test(sin), false);
  });

  test("el curso sale del grupo", () => {
    assert.equal(nivelDelGrupo({ stage: "eso", year: 1 }), "1.º de ESO");
    assert.equal(nivelDelGrupo({ stage: "primaria", year: 3 }), "3.º de Primaria");
    assert.equal(nivelDelGrupo({ level: "bachillerato" }), "Bachillerato");
    assert.equal(nivelDelGrupo(null), null);
  });

  test("REGRESIÓN: nombre, curso y asignatura salen de la base (sesión → tarea y alumno → grupo)", async () => {
    const filas = {
      tutor_sessions: { student_id: "s1", task_id: "t1" },
      tasks: { subject_name: "Lengua" },
      students: { first_name: "Leo", group_id: "g1" },
      groups: { stage: "eso", year: 2 },
    };
    const admin = { from: (tabla) => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: filas[tabla], error: null }) }; return q; } };
    assert.deepEqual(await fetchContextoDelAlumno(admin, { sessionId: "x", tenantId: "c" }),
      { alumno_nombre: "Leo", nivel_educativo: "2.º de ESO", asignatura: "Lengua" });
  });

  test("si la base falla, el tutor sigue sin el dato (es contexto, no permiso)", async () => {
    const admin = { from: () => { throw new Error("caída"); } };
    assert.deepEqual(await fetchContextoDelAlumno(admin, { sessionId: "x", tenantId: "c" }), {});
  });
}
