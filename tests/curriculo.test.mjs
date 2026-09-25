import assert from "node:assert/strict";

// EL CURRÍCULO DE ESO DE ARAGÓN EXTRAÍDO DE LOS PDF (server/lib/curriculo/).
export async function run({ test }) {
  const { listaDeMaterias, materiaPorSlug, curriculoDeCurso, horario, sesionesSemanales } = await import("../server/lib/curriculo/curriculoAragon.js");
  const { CITAS, NOMBRE_DEL_SABER } = await import("../server/lib/generadorEjercicios/saberesBasicos.js");
  const { createApp } = await import("../server/app.js");

  test("las 40 materias del anexo II están, y cada una tiene competencias, criterios y saberes", () => {
    const materias = listaDeMaterias();
    assert.equal(materias.length, 40);
    for (const m of materias) {
      const d = materiaPorSlug(m.slug);
      assert.ok(d, m.slug);
      assert.ok(d.competencias.length >= 1, `${m.materia}: sin competencias`);
      assert.ok(d.criterios.length >= 1, `${m.materia}: sin criterios`);
      const saberes = d.saberes.flatMap((s) => s.bloques.flatMap((b) => b.apartados.flatMap((a) => a.saberes)));
      assert.ok(saberes.length >= 5, `${m.materia}: solo ${saberes.length} saberes`);
      // La comprobación literal de la extracción no baja del 75 % en ninguna.
      assert.ok(m.literal >= 75, `${m.materia}: ${m.literal} % literal`);
    }
  });

  test("DOS COPIAS, UN CURRÍCULO: las citas que usa el generador de hojas están literales en Matemáticas 1.º", () => {
    // saberesBasicos.js se copió a mano del PDF el 17/9; esto se extrajo
    // con un programa el 24/9. Tienen que coincidir.
    const c = curriculoDeCurso("matematicas", 1);
    const apartados = c.saberes.flatMap((s) => s.bloques.flatMap((b) => b.apartados));
    const de = (codigo) => apartados.find((a) => a.codigo === codigo);
    for (const cita of [CITAS.CANTIDADES, CITAS.REPRESENTACION]) assert.ok(de("A.2").saberes.includes(cita), cita);
    for (const cita of [CITAS.OPERACIONES, CITAS.PROPIEDADES, CITAS.INVERSAS]) assert.ok(de("A.3").saberes.includes(cita), cita);
    assert.ok(de("A.4").saberes.includes(CITAS.PATRONES));
    assert.ok(de("A.4").saberes.includes(CITAS.FACTORES));
    assert.ok(de("A.4").saberes.includes(CITAS.COMPARACION));
    assert.ok(de("A.2").saberes.includes(CITAS.PORCENTAJES_RAROS));
    assert.ok(de("A.2").saberes.includes(CITAS.ESTIMACIONES));
    assert.ok(de("A.3").saberes.includes(CITAS.EFECTO));
    for (const cita of [CITAS.RECUENTO, CITAS.TAMANO]) assert.ok(de("A.1").saberes.includes(cita), cita);
    assert.ok(de("A.3").saberes.includes(CITAS.MENTAL));
    for (const cita of [CITAS.ATRIBUTOS, CITAS.ELECCION]) assert.ok(de("B.1").saberes.includes(cita), cita);
    assert.ok(de("B.3").saberes.includes(CITAS.CONJETURAS));
    for (const cita of [CITAS.ANGULOS, CITAS.AREAS, CITAS.REPRESENTACIONES_AREAS]) assert.ok(de("B.2").saberes.includes(cita), cita);
    assert.ok(de("C.1").saberes.includes(CITAS.CLASIFICACION));
    assert.ok(de("C.4").saberes.includes(CITAS.MODELIZACION_GEO));
    for (const cita of [CITAS.RAZONES, CITAS.PORCENTAJES, CITAS.SITUACIONES]) assert.ok(de("A.5").saberes.includes(cita), cita);
    for (const cita of [CITAS.CONSUMO, CITAS.FINANCIERA]) assert.ok(de("A.6").saberes.includes(cita), cita);
    assert.ok(de("D.1").saberes.includes(CITAS.REGLA));
    assert.ok(de("D.2").saberes.includes(CITAS.MODELIZACION));
    assert.ok(de("D.3").saberes.includes(CITAS.VARIABLE));
    for (const cita of [CITAS.EQUIVALENCIA, CITAS.ECUACIONES]) assert.ok(de("D.4").saberes.includes(cita), cita);
    // En el texto extraído del PDF de 1.º falta un espacio ("científicay"),
    // que en 2.º y 3.º sí está: se compara sin espacios.
    const sinEspacios = (t) => t.replace(/\s+/g, "");
    assert.ok(de("A.2").saberes.map(sinEspacios).includes(sinEspacios(CITAS.GRANDES)));
    for (const [codigo, nombre] of Object.entries(NOMBRE_DEL_SABER)) assert.equal(de(codigo).nombre, nombre);
  });

  test("Matemáticas: 10 competencias; en 4.º, los criterios de Matemáticas A y B, no los de 1.º-3.º", () => {
    const m = materiaPorSlug("matematicas");
    assert.deepEqual(m.competencias.map((c) => c.codigo), Array.from({ length: 10 }, (_, i) => `CE.M.${i + 1}`));
    const cuarto = curriculoDeCurso("matematicas", 4);
    const columnas = new Set(cuarto.competencias.flatMap((c) => c.criterios.map((k) => k.columna)));
    assert.deepEqual([...columnas].sort(), ["Matemáticas A (4º ESO)", "Matemáticas B (4º ESO)"]);
    assert.deepEqual(cuarto.saberes.map((s) => s.etiqueta), ["Matemáticas A (4º ESO)", "Matemáticas B (4º ESO)"]);
    const primero = curriculoDeCurso("matematicas", 1);
    assert.equal(primero.competencias[0].criterios[0].texto,
      "Interpretar problemas matemáticos organizando los datos dados, estableciendo las relaciones entre ellos y comprendiendo las preguntas formuladas.");
  });

  test("EL HORARIO (anexo III): todas sus materias existen; da el curso a las de un solo curso", () => {
    const slugs = new Set(listaDeMaterias().map((m) => m.slug));
    for (const slug of Object.keys(horario()).filter((k) => !k.startsWith("_"))) assert.ok(slugs.has(slug), slug);
    assert.equal(sesionesSemanales("matematicas", 3), 3);
    assert.equal(sesionesSemanales("matematicas", 1), 4);
    assert.equal(sesionesSemanales("ambito-linguistico-y-social", 4), 11);
    assert.equal(sesionesSemanales("musica", 2), null, "Música no se imparte en 2.º");
    const filosofia = listaDeMaterias().find((m) => m.slug === "filosofia");
    assert.deepEqual(filosofia.cursos, [4]);
    assert.equal(curriculoDeCurso("matematicas", 2).sesionesSemanales, 4);
  });

  test("una materia que no existe (o un nombre raro) no se busca en el disco", () => {
    assert.equal(materiaPorSlug("no-existe"), null);
    assert.equal(materiaPorSlug("../package"), null);
    assert.equal(curriculoDeCurso("no-existe", 1), null);
  });

  for (const url of ["/api/v1/recursos/curriculo", "/api/v1/recursos/curriculo/matematicas?curso=1"]) {
    test(`currículo wiring: GET ${url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method: "GET", url });
      await app.close();
      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `recibió ${res.statusCode}`);
    });
  }
}
