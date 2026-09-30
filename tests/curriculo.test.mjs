import assert from "node:assert/strict";

// EL CURRÍCULO DE ESO DE ARAGÓN EXTRAÍDO DE LOS PDF (server/lib/curriculo/).
export async function run({ test }) {
  const { listaDeMaterias, materiaPorSlug, curriculoDeCurso, horario, sesionesSemanales } = await import("../server/lib/curriculo/curriculoAragon.js");
  const { CITAS, NOMBRE_DEL_SABER } = await import("../server/lib/generadorEjercicios/saberesBasicos.js");
  const { createApp } = await import("../server/app.js");

  test("las materias del anexo II de las tres etapas están, y cada una tiene competencias, criterios y saberes", () => {
    const materias = listaDeMaterias();
    const cuantas = (etapa) => materias.filter((m) => m.etapa === etapa).length;
    // ESO 40 (con los 4 ámbitos de FP Básica), Primaria 14, Bachillerato 59.
    assert.equal(cuantas("ESO") + cuantas("FP Básica"), 40);
    assert.equal(cuantas("Primaria"), 14);
    assert.equal(cuantas("Bachillerato"), 59);
    assert.equal(new Set(materias.map((m) => m.slug)).size, materias.length, "ningún slug repetido entre etapas");
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
    for (const cita of [CITAS.CUANTITATIVAS, CITAS.LINEALES_REPRESENTACION, CITAS.INFORMACION_FUNCION]) assert.ok(de("D.5").saberes.includes(cita), cita);
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

  test("PRIMARIA (ECD/1112/2022 + ECD/866/2024): criterios y saberes por ciclo, literales del BOA", () => {
    const m = materiaPorSlug("primaria-matematicas");
    assert.match(m.fuente, /ECD\/1112\/2022.*ECD\/866\/2024/);
    const tercero = curriculoDeCurso("primaria-matematicas", 3);
    assert.equal(tercero.etapa, "primaria");
    // 3.º es del segundo ciclo: su 1.1 es el del segundo ciclo, no el del primero.
    assert.equal(tercero.competencias[0].criterios[0].texto,
      "Interpretar, de forma verbal o gráfica, problemas cercanos y significativos para el alumnado, comprendiendo las preguntas planteadas a través de diferentes estrategias o herramientas.");
    assert.equal(curriculoDeCurso("primaria-matematicas", 1).competencias[0].criterios[0].texto,
      "Reconocer la información contenida en problemas en situaciones cercanas y significativas para el alumnado comprendiendo las preguntas planteadas a través de diferentes estrategias o herramientas.");
    assert.deepEqual(tercero.saberes.map((s) => s.etiqueta), ["Segundo ciclo de Educación Primaria"]);
    assert.deepEqual(listaDeMaterias().find((x) => x.slug === "primaria-matematicas").cursos, [1, 2, 3, 4, 5, 6]);
    // Errata del BOA corregida a la vista (extrae_curriculo.py): Valores
    // Cívicos es de 5.º y 6.º aunque su apartado diga "Primer ciclo".
    const valores = materiaPorSlug("primaria-educacion-en-valores-civicos-y-eticos");
    assert.deepEqual(valores.saberes.map((s) => [s.etiqueta, s.cursos]), [["Tercer ciclo de Educación Primaria", [5, 6]]]);
    assert.equal(curriculoDeCurso("primaria-educacion-en-valores-civicos-y-eticos", 2).competencias.flatMap((c) => c.criterios).length, 0);
    // Errata del BOA: en Ciencias Sociales, tercer ciclo, el "6.4" que va
    // bajo CE.CS.2 es el 2.4; el 6.4 es "Presentar los resultados…".
    const cs = curriculoDeCurso("primaria-ciencias-sociales", 5);
    assert.deepEqual(cs.competencias.find((c) => c.codigo === "CE.CS.2").criterios.map((k) => k.codigo), ["2.1", "2.2", "2.3", "2.4"]);
    assert.match(cs.competencias.find((c) => c.codigo === "CE.CS.6").criterios.find((k) => k.codigo === "6.4").texto, /^Presentar los resultados/);
    // Ningún criterio repetido (mismo número, ciclo y texto) en Primaria ni Bachillerato.
    for (const m of listaDeMaterias().filter((x) => x.etapa === "Primaria" || x.etapa === "Bachillerato")) {
      const claves = materiaPorSlug(m.slug).criterios.map((c) => `${c.competencia} ${c.codigo} ${c.cursos} ${c.texto}`);
      assert.equal(new Set(claves).size, claves.length, `${m.materia} (${m.etapa}): criterio repetido`);
      // Ni uno cortado junto al completo (una celda leída en dos tablas).
      const cs2 = materiaPorSlug(m.slug).criterios;
      for (const a of cs2) {
        const cortado = cs2.some((b) => b !== a && b.competencia === a.competencia && b.codigo === a.codigo && String(b.cursos) === String(a.cursos) && b.texto.length > a.texto.length && b.texto.startsWith(a.texto));
        assert.ok(!cortado, `${m.materia}: ${a.codigo} cortado`);
      }
    }
    // Cada ciclo con sus criterios (no se cuelan los de otro por un salto de página).
    for (const slug of ["primaria-lengua-extranjera-ingles", "primaria-lengua-extranjera-frances"]) {
      const porCiclo = [1, 3, 5].map((c) => curriculoDeCurso(slug, c).competencias.find((ce) => ce.codigo === "CE.LEF.3" || ce.codigo === "CE.LEI.3" || /\.3$/.test(ce.codigo)).criterios.map((k) => k.codigo));
      for (const codigos of porCiclo) assert.equal(new Set(codigos).size, codigos.length, `${slug}: criterio repetido en un ciclo`);
    }
  });

  test("BACHILLERATO (ECD/1173/2022 + ECD/886/2024): I y II separados; el horario de 2025 da el curso a las de un solo curso", () => {
    const m2 = curriculoDeCurso("bachillerato-matematicas", 2);
    assert.equal(m2.etapa, "bachillerato");
    assert.deepEqual(m2.saberes.map((s) => s.etiqueta), ["Matemáticas II"]);
    assert.equal(m2.competencias[0].criterios[0].texto,
      "Manejar diferentes estrategias y herramientas, incluidas las digitales, que modelizan y resuelven problemas de la vida cotidiana y de la ciencia y la tecnología, seleccionando las más adecuadas según su eficiencia.");
    const lista = listaDeMaterias().filter((x) => x.etapa === "Bachillerato");
    for (const x of lista) assert.ok(x.cursos.length, `${x.materia}: sin curso`);
    assert.deepEqual(lista.find((x) => x.slug === "bachillerato-fisica").cursos, [2]);
    assert.deepEqual(lista.find((x) => x.slug === "bachillerato-filosofia").cursos, [1]);
    assert.equal(sesionesSemanales("bachillerato-fisica", 2), 4);
    assert.equal(sesionesSemanales("bachillerato-fisica", 1), null);
    assert.equal(sesionesSemanales("bachillerato-lengua-castellana-y-literatura", 2), 4);
    // Los criterios de la sección IV no se cuentan dos veces.
    const pii = materiaPorSlug("bachillerato-proyecto-de-investigacion-e-innovacion-integrado");
    assert.equal(new Set(pii.criterios.map((c) => `${c.competencia} ${c.codigo}`)).size, pii.criterios.length);
    // Las modificadas en 2024 vienen de la versión nueva.
    assert.match(materiaPorSlug("bachillerato-historia-de-espana").archivo, /Historia de España/);
  });

  test("HORARIOS DE PRIMARIA Y BACHILLERATO: cada materia existe; Primaria en sesiones de 45 minutos", () => {
    const slugs = new Set(listaDeMaterias().map((m) => m.slug));
    for (const [etapa, prefijo] of [["primaria", "primaria-"], ["bachillerato", "bachillerato-"]]) {
      for (const slug of Object.keys(horario(etapa)).filter((k) => !k.startsWith("_"))) assert.ok(slugs.has(prefijo + slug), `${etapa}: ${slug}`);
    }
    assert.equal(horario("primaria")._minutos.matematicas["1"], 225);
    assert.equal(sesionesSemanales("primaria-matematicas", 1), 5);
    assert.equal(sesionesSemanales("primaria-educacion-fisica", 6), 3, "135 minutos en el tercer ciclo");
    assert.equal(sesionesSemanales("primaria-educacion-en-valores-civicos-y-eticos", 4), null);
    assert.equal(sesionesSemanales("matematicas", 1), 4, "ESO no cambia");
  });

  test("una materia que no existe (o un nombre raro) no se busca en el disco", () => {
    assert.equal(materiaPorSlug("no-existe"), null);
    assert.equal(materiaPorSlug("../package"), null);
    assert.equal(curriculoDeCurso("no-existe", 1), null);
    assert.equal(materiaPorSlug("primaria-no-existe"), null);
    assert.equal(materiaPorSlug("bachillerato-../x"), null);
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
