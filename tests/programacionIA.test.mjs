import fs from "node:fs";

// RECURSOS → PROGRAMACIÓN, EL BORRADOR CON IA (server/lib/programaciones/ia/).
// La IA se sustituye por un cliente falso: lo que se prueba es que su
// respuesta no se cree sin mirarla.
export async function run({ test, assert }) {
  const RAIZ = new URL("../", import.meta.url).pathname;
  const { validaUnidades, proponUnidades, mensajeDelCurriculo } = await import("../server/lib/programaciones/ia/proponUnidades.js");
  const { redactaTextos, validaTextos, letrasDeTexto, esquemaDeTextos, GUIA, promptDeTextos } = await import("../server/lib/programaciones/ia/redactaTextos.js");
  const { curriculoDeCurso } = await import("../server/lib/curriculo/curriculoAragon.js");
  const { saberesConId, criteriosDe, cobertura } = await import("../assets/shared/programacion/estructuraDeLaProgramacion.js");
  const { DatosSchema } = await import("../server/lib/programaciones/programaciones.js");
  const { createApp } = await import("../server/app.js");

  const cur = curriculoDeCurso("matematicas", 1);
  const ids = saberesConId(cur).map((s) => s.id);
  const codigos = criteriosDe(cur).map((k) => k.codigo);
  const clienteQueDevuelve = (input) => {
    const llamadas = [];
    return {
      llamadas,
      messages: { create: async (p) => { llamadas.push(p); return { content: [{ type: "tool_use", name: p.tool_choice.name, input }], usage: { input_tokens: 10, output_tokens: 5 } }; } },
    };
  };

  test("UNIDADES: ids inventados fuera, lo que faltaba se añade, y la cobertura queda completa", () => {
    const mitad = Math.floor(ids.length / 2);
    const { unidades, arreglos } = validaUnidades(cur, {
      unidades: [
        { titulo: "Números naturales", trimestre: 1, sesiones: 20, saberes: [...ids.slice(0, mitad), "s9.9.9.9"], criterios: [codigos[0], "99.9"] },
        { titulo: "Enteros", trimestre: 1, sesiones: 20, saberes: ids.slice(mitad, mitad + 3), criterios: [] },
      ],
    }, { sesionesTotales: 140 });
    assert.equal(arreglos.idsInventados, 2);
    assert.ok(arreglos.saberesAnadidos > 0);
    assert.equal(cobertura(cur, unidades).completa, true, "ningún saber ni criterio sin unidad");
    assert.equal(unidades.reduce((n, u) => n + u.sesiones, 0), 140, "las sesiones cuadran con el curso");
    assert.equal(unidades.every((u) => u.saberes.every((id) => ids.includes(id))), true);
  });

  test("un criterio olvidado va a las unidades de su competencia, no todos a la última", () => {
    const ce1 = criteriosDe(cur).filter((k) => k.competencia === "CE.M.1").map((k) => k.codigo);
    const { unidades } = validaUnidades(cur, {
      unidades: [
        { titulo: "A", trimestre: 1, sesiones: 10, saberes: ids.slice(0, 5), criterios: [ce1[0]] },
        { titulo: "B", trimestre: 2, sesiones: 10, saberes: ids.slice(5), criterios: [] },
      ],
    });
    assert.ok(ce1.slice(1).every((c) => unidades[0].criterios.includes(c)), "los de CE.M.1, con el suyo");
    assert.equal(ce1.slice(1).some((c) => unidades[1].criterios.includes(c)), false);
    const otro = criteriosDe(cur).find((k) => k.competencia !== "CE.M.1").codigo;
    assert.ok(unidades.every((u) => u.criterios.includes(otro)), "una competencia que no aparece: en todas");
  });

  test("REGRESIÓN (prueba real 24/9): los saberes del sentido socioafectivo van en TODAS las unidades, no solo en la primera", () => {
    const socio = saberesConId(cur).filter((s) => /socioafectiv/i.test(s.bloque)).map((s) => s.id);
    assert.ok(socio.length > 0);
    const otros = ids.filter((id) => !socio.includes(id));
    const { unidades } = validaUnidades(cur, {
      unidades: [
        { titulo: "A", trimestre: 1, sesiones: 10, saberes: [...otros.slice(0, 10), ...socio], criterios: [] },
        { titulo: "B", trimestre: 2, sesiones: 10, saberes: otros.slice(10), criterios: [] },
      ],
    });
    assert.ok(socio.every((id) => unidades[1].saberes.includes(id)));
  });

  test("unidades: los trimestres no van hacia atrás y una unidad sin saberes válidos se descarta", () => {
    const { unidades } = validaUnidades(cur, {
      unidades: [
        { titulo: "A", trimestre: 2, sesiones: 10, saberes: [ids[0]], criterios: [] },
        { titulo: "B", trimestre: 1, sesiones: 10, saberes: [ids[1]], criterios: [] },
        { titulo: "Fantasma", trimestre: 3, sesiones: 10, saberes: ["s7.7.7.7"], criterios: [] },
      ],
    });
    assert.deepEqual(unidades.map((u) => [u.titulo, u.trimestre]), [["A", 2], ["B", 2]]);
  });

  test("unidades: sin nada aprovechable, lista vacía (la ruta responde 502, no una programación vacía)", () => {
    assert.equal(validaUnidades(cur, { unidades: [] }).unidades.length, 0);
    assert.equal(validaUnidades(cur, null).unidades.length, 0);
  });

  test("a la IA se le da el currículo con sus ids y sus criterios, y se le obliga a usar la herramienta", async () => {
    const cliente = clienteQueDevuelve({ unidades: [{ titulo: "Todo", trimestre: 1, sesiones: 5, saberes: ids, criterios: codigos }] });
    const r = await proponUnidades({ client: cliente, model: "m", curriculo: cur, materiaSlug: "matematicas", curso: 1, sesionesTotales: 140 });
    const p = cliente.llamadas[0];
    assert.equal(p.tool_choice.name, "propon_unidades");
    assert.match(p.system, /Matemáticas/);
    assert.match(p.messages[0].content, new RegExp(ids[0].replace(/\./g, "\\.")));
    assert.equal(r.unidades[0].sesiones, 140);
    assert.ok(r.usage);
    assert.ok(mensajeDelCurriculo(cur).includes("CE.M.1"));
  });

  test("TEXTOS: solo las letras pedidas, recortadas, y el prompt prohíbe inventar datos del centro", async () => {
    const cliente = clienteQueDevuelve({ apartado_f: "Medidas de atención…", apartado_j: "  ", zz: "no pedida" });
    const r = await redactaTextos({ client: cliente, model: "m", curriculo: { ...cur, curso: 1 }, materiaSlug: "matematicas", datos: { unidades: [], pesos: {} }, letras: ["f", "j"] });
    assert.deepEqual(r.textos, { f: "Medidas de atención…" }, "j vacío no cuenta; zz no se pidió");
    assert.match(cliente.llamadas[0].system, /\[a completar por el centro\]/);
    assert.match(cliente.llamadas[0].messages[0].content, /f\) Actuaciones generales/);
    assert.equal(validaTextos({ c: "x".repeat(30000) }, ["c"]).c.length, 20000);
    assert.deepEqual(letrasDeTexto("matematicas"), ["c", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "ñ"]);
    assert.deepEqual(letrasDeTexto("primaria-matematicas"), ["c", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n"]);
    assert.deepEqual(letrasDeTexto("bachillerato-fisica"), ["c", "e", "f", "g", "h", "i", "j", "k", "l", "m"]);
  });

  test("REGRESIÓN (24/9): pedir f–ñ fallaba entero — las claves de la herramienta solo pueden ser [a-zA-Z0-9_.-]", async () => {
    const claves = Object.keys(esquemaDeTextos(letrasDeTexto("matematicas")).properties);
    for (const k of claves) assert.match(k, /^[a-zA-Z0-9_.-]{1,64}$/, `clave inválida para la API: ${k}`);
    const cliente = clienteQueDevuelve({ apartado_nn: "Salida al museo de la ciencia [a completar por el centro]." });
    const r = await redactaTextos({ client: cliente, model: "m", curriculo: { ...cur, curso: 1 }, materiaSlug: "matematicas", datos: { unidades: [], pesos: {} }, letras: ["ñ"] });
    assert.equal(r.textos["ñ"], "Salida al museo de la ciencia [a completar por el centro].", "y lo que vuelve se guarda en la ñ");
  });

  test("REGRESIÓN (24/9): cada apartado lleva qué tiene que incluir, y el prompt prohíbe repetir el contexto", async () => {
    const cliente = clienteQueDevuelve({});
    await redactaTextos({ client: cliente, model: "m", curriculo: { ...cur, curso: 1 }, materiaSlug: "matematicas", datos: { unidades: [], pesos: {} }, letras: ["c", "e"] });
    const msg = cliente.llamadas[0].messages[0].content;
    assert.ok(msg.includes(GUIA.instrumentos) && msg.includes(GUIA.inicial));
    assert.match(cliente.llamadas[0].system, /NO repitas los datos del contexto/);
    const { apartadosDeTextoDe } = await import("../assets/shared/programacion/apartadosLegales.js");
    for (const slug of ["matematicas", "primaria-matematicas", "bachillerato-fisica"]) {
      for (const a of apartadosDeTextoDe(slug)) assert.ok(GUIA[a.clave], `falta la guía de ${slug} ${a.letra}`);
    }
  });

  test("ETAPAS (30/9): la guía va por lo que ES el apartado, no por su letra; en Primaria escribe el equipo de ciclo", async () => {
    // La h) de Bachillerato es la metodología; la de ESO, la materia pendiente.
    const cliente = clienteQueDevuelve({});
    await redactaTextos({ client: cliente, model: "m", curriculo: { ...cur, curso: 1 }, materiaSlug: "bachillerato-fisica", datos: { unidades: [], pesos: {} }, letras: ["g", "h"] });
    const msg = cliente.llamadas[0].messages[0].content;
    assert.ok(msg.includes(`g) Plan de recuperación de materias pendientes.`));
    assert.ok(msg.includes(GUIA.pendientes) && msg.includes(GUIA.metodologia));
    assert.match(cliente.llamadas[0].system, /1\.º de Bachillerato según el artículo 54\.3 de la ORDEN ECD\/1173\/2022/);
    const pri = promptDeTextos({ materia: "Matemáticas", materiaSlug: "primaria-matematicas", curso: 3 });
    assert.match(pri, /maestro o maestra de Matemáticas en un colegio de Aragón/);
    assert.match(pri, /3\.º de Primaria según el artículo 42\.3 de la ORDEN ECD\/1112\/2022/);
    assert.match(pri, /equipo didáctico de ciclo/);
    assert.doesNotMatch(pri, /departamento/);
    assert.match(promptDeTextos({ materia: "Matemáticas", materiaSlug: "matematicas", curso: 1 }), /jefe de departamento de Matemáticas en un instituto de Aragón y redactas la programación didáctica de 1\.º de ESO según el artículo 59\.3/);
  });

  test("las frases sobre las instrucciones no llegan al documento", () => {
    const r = validaTextos({ apartado_c: "Se usará una rúbrica por criterio. No se inventan datos del centro. Se devolverá corregido." }, ["c"]);
    assert.equal(r.c, "Se usará una rúbrica por criterio. Se devolverá corregido.");
  });

  test("la marca de borrador se guarda; algo que no es suyo no", () => {
    assert.ok(DatosSchema.safeParse({ ia: { unidades: "2026-09-24T10:00:00Z", textos: ["f", "g"] } }).success);
    assert.ok(!DatosSchema.safeParse({ ia: { otra: 1 } }).success);
  });

  test("la migración 132 admite el gasto de las dos rutas", () => {
    const sql = fs.readFileSync(`${RAIZ}supabase/migrations/132_token_usage_programacion_ia.sql`, "utf8");
    for (const s of ["hojas_interpretar", "programacion_unidades", "programacion_textos"]) assert.ok(sql.includes(`'${s}'`), s);
    const ruta = fs.readFileSync(`${RAIZ}server/routes/v1/recursos.programaciones.ia.routes.js`, "utf8");
    assert.ok(ruta.includes('"programacion_unidades"') && ruta.includes('"programacion_textos"'));
  });

  for (const url of ["/api/v1/recursos/programaciones/ia/unidades", "/api/v1/recursos/programaciones/ia/textos"]) {
    test(`wiring: POST ${url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method: "POST", url, payload: {} });
      await app.close();
      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `recibió ${res.statusCode}`);
    });
  }
}
