// EL PEDIDO EN PALABRAS (interpretePedido.js): la IA elige del catálogo y su
// respuesta NO se cree hasta contrastarla con él. Aquí no se llama a Claude:
// se prueba con un cliente falso lo que se le manda y, sobre todo, qué se
// hace con lo que contesta, incluido cuando contesta mal.
export async function run({ test, assert }) {
  const { ENTEROS_1ESO } = await import("../../server/lib/generadorEjercicios/temas/enteros1eso.js");
  const {
    validaPropuesta, interpretaPedido, promptDeSistema, mensajesDe, HERRAMIENTA, MAX_TURNOS,
  } = await import("../../server/lib/generadorEjercicios/interpretePedido.js");
  const { catalogoDelPanel } = await import("../../server/lib/generadorEjercicios/hojaDelPanel.js");
  const { montaHoja } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");

  const catalogo = catalogoDelPanel();
  const TEMA = catalogo.temas[0].id;
  const ctx = { temaId: TEMA, objetivo: 1, intensidad: "normal" };

  test("una hoja válida pasa limpia, con el tema del contexto si la IA no lo dice", () => {
    const r = validaPropuesta(catalogo, {
      accion: "hoja", objetivo: 1, intensidad: "refuerzo",
      baterias: ["compara_enteros", "compara_enteros", "ordena_lista"], explicacion: "Dos de comparar y uno de ordenar.",
    }, ctx);
    assert.equal(r.accion, "hoja");
    assert.deepEqual(r.plan, {
      temaId: TEMA, objetivo: 1, intensidad: "refuerzo", baterias: ["compara_enteros", "compara_enteros", "ordena_lista"],
    });
  });

  test("CON DOS TEMAS: la IA puede cambiar de tema, y una clave de OTRO tema no se cuela en este", () => {
    const DIV = catalogo.temas.find((t) => t.nombre === "Divisibilidad").id;
    const r = validaPropuesta(catalogo, {
      accion: "hoja", temaId: DIV, objetivo: 5, baterias: ["mcm_de_dos"], explicacion: "Una de m.c.m.",
    }, ctx);
    assert.equal(r.accion, "hoja");
    assert.deepEqual(r.plan, { temaId: DIV, objetivo: 5, intensidad: "normal", baterias: ["mcm_de_dos"] });
    // Pedir m.c.m. dentro del tema de enteros: la clave no es de ese tema.
    const cruzada = validaPropuesta(catalogo, { accion: "hoja", objetivo: 1, baterias: ["mcm_de_dos"], explicacion: "x" }, ctx);
    assert.equal(cruzada.accion, "pregunta");
    assert.ok(promptDeSistema(catalogo).includes("Cada hoja es de UN tema"));
  });

  test("UNA CLAVE INVENTADA NO LLEGA AL MONTADOR: si no queda ninguna válida, se convierte en pregunta", () => {
    const r = validaPropuesta(catalogo, { accion: "hoja", objetivo: 1, baterias: ["raices_cuadradas"], explicacion: "x" }, ctx);
    assert.equal(r.accion, "pregunta");
    assert.equal(validaPropuesta(catalogo, { accion: "hoja", objetivo: 9, explicacion: "x" }, ctx).accion, "pregunta");
    assert.equal(validaPropuesta(catalogo, { accion: "otra cosa" }, ctx).accion, "pregunta");
    assert.equal(validaPropuesta(catalogo, undefined, ctx).accion, "pregunta");
  });

  test("REGRESIÓN 23/9: MEZCLAR OBJETIVOS vale; el objetivo de la hoja es el más alto de los pedidos", () => {
    // "dos de comparar, uno de ordenar, otro de recta y uno de sumas" con el
    // objetivo 1 en pantalla: antes, "no lo he entendido".
    const r = validaPropuesta(catalogo, {
      accion: "hoja", objetivo: 1,
      baterias: ["compara_enteros", "compara_enteros", "ordena_lista", "representa_en_recta", "suma_mismo_signo"],
      explicacion: "Hoja mixta.",
    }, ctx);
    assert.equal(r.accion, "hoja");
    assert.equal(r.plan.objetivo, 3);
    assert.equal(r.plan.baterias.length, 5);
    // Y el montador la monta: las del objetivo 1 entran como repaso.
    const { hoja } = montaHoja({ tema: ENTEROS_1ESO, objetivo: r.plan.objetivo, baterias: r.plan.baterias, azar: crearAzar("mixta") });
    assert.equal(hoja.actividades.length, 5);
  });

  test("una clave que no existe se deja fuera y se dice; el resto de la hoja sigue", () => {
    const r = validaPropuesta(catalogo, { accion: "hoja", objetivo: 1, baterias: ["compara_enteros", "raices_cuadradas"], explicacion: "Hoja." }, ctx);
    assert.equal(r.accion, "hoja");
    assert.deepEqual(r.plan.baterias, ["compara_enteros"]);
    assert.ok(r.explicacion.includes("se ha dejado fuera"));
    assert.equal("descartadas" in r.plan, false);
  });

  test("intensidad desconocida cae a normal; demasiados ejercicios, al máximo del objetivo", () => {
    const r = validaPropuesta(catalogo, { accion: "hoja", objetivo: 4, intensidad: "brutal", actividades: 9, explicacion: "x" }, ctx);
    assert.equal(r.plan.intensidad, "normal");
    assert.equal(r.plan.actividades, catalogo.temas[0].objetivos[3].maxActividades);
  });

  test("FUERA DE CATÁLOGO: se dice, con lo más parecido solo si es válido", () => {
    const con = validaPropuesta(catalogo, {
      accion: "fuera_de_catalogo", explicacion: "Las raíces no están en este tema.",
      parecido: { objetivo: 5, baterias: ["potencias_base_entera"] },
    }, ctx);
    assert.equal(con.accion, "fuera_de_catalogo");
    assert.equal(con.parecido.objetivo, 5);
    const malo = validaPropuesta(catalogo, { accion: "fuera_de_catalogo", explicacion: "x", parecido: { objetivo: 5, baterias: ["raices"] } }, ctx);
    assert.equal(malo.parecido, null);
  });

  test("CAMBIAR UN EJERCICIO: solo si hay uno elegido y la clave es de su objetivo", () => {
    const elegido = { ...ctx, ejercicio: { orden: 2, objetivo: 3, clave: "suma_mismo_signo" } };
    assert.deepEqual(validaPropuesta(catalogo, { accion: "ejercicio", clave: "resta_con_parentesis", explicacion: "e" }, elegido),
      { accion: "ejercicio", clave: "resta_con_parentesis", explicacion: "e" });
    assert.equal(validaPropuesta(catalogo, { accion: "ejercicio", clave: "resta_con_parentesis", explicacion: "e" }, ctx).accion, "pregunta");
    assert.equal(validaPropuesta(catalogo, { accion: "ejercicio", clave: "combinada_un_nivel", explicacion: "e" }, elegido).accion, "pregunta");
  });

  test("AÑADIR UN EJERCICIO: con `nuevo` en el contexto vale una batería de ese objetivo o anteriores", () => {
    const nuevo = { ...ctx, objetivo: 3, nuevo: { objetivo: 3 } };
    assert.deepEqual(validaPropuesta(catalogo, { accion: "ejercicio", clave: "compara_enteros", explicacion: "x" }, nuevo).clave, "compara_enteros");
    assert.equal(validaPropuesta(catalogo, { accion: "ejercicio", clave: "combinada_un_nivel", explicacion: "x" }, nuevo).accion, "pregunta");
    assert.ok(mensajesDe({ conversacion: [{ rol: "profesor", texto: "uno de ordenar" }], contexto: nuevo })[0].content.includes("EJERCICIO NUEVO"));
  });

  test("una pregunta sin texto no se enseña; las opciones se recortan", () => {
    assert.equal(validaPropuesta(catalogo, { accion: "pregunta", pregunta: "" }, ctx).pregunta.startsWith("No lo he entendido"), true);
    const r = validaPropuesta(catalogo, { accion: "pregunta", pregunta: "¿Qué nivel?", opciones: ["a", "b", "c", "d", "e", "f", "g"] }, ctx);
    assert.equal(r.opciones.length, 6);
  });

  test("el prompt lleva el catálogo cerrado y prohíbe escribir ejercicios", () => {
    const p = promptDeSistema(catalogo);
    assert.ok(p.includes("compara_enteros: Completa con el signo > o <"));
    assert.ok(p.includes("No escribas ejercicios"));
  });

  test("el contexto va en el primer mensaje y el historial se recorta", () => {
    const conversacion = Array.from({ length: MAX_TURNOS + 4 }, (_, i) => ({ rol: i % 2 ? "asistente" : "profesor", texto: `t${i}` }));
    const m = mensajesDe({ conversacion, contexto: { ...ctx, ejercicio: { orden: 3, objetivo: 1, clave: "ordena_lista" } } });
    assert.equal(m.length, MAX_TURNOS);
    assert.ok(m[0].content.startsWith("EN PANTALLA:"));
    assert.ok(m[0].content.includes("EJERCICIO ELEGIDO: el 3"));
  });

  test("la llamada fuerza la herramienta y valida lo que vuelve", async () => {
    let enviado = null;
    const client = { messages: { create: async (req) => {
      enviado = req;
      return {
        content: [{ type: "tool_use", name: HERRAMIENTA, input: { accion: "hoja", objetivo: 2, explicacion: "Valor absoluto." } }],
        usage: { input_tokens: 10, output_tokens: 5 },
      };
    } } };
    const { resultado, usage } = await interpretaPedido({
      client, model: "m", catalogo, conversacion: [{ rol: "profesor", texto: "valor absoluto" }], contexto: ctx,
    });
    assert.deepEqual(enviado.tool_choice, { type: "tool", name: HERRAMIENTA });
    assert.equal(resultado.accion, "hoja");
    assert.equal(resultado.plan.objetivo, 2);
    assert.equal(usage.output_tokens, 5);
  });

  test("cuando no se entiende, devuelve lo que contestó el modelo para dejarlo en el registro", async () => {
    const input = { accion: "hoja", baterias: ["nada_de_esto"], explicacion: "x" };
    const client = { messages: { create: async () => ({ content: [{ type: "tool_use", name: HERRAMIENTA, input }], usage: {} }) } };
    const r = await interpretaPedido({ client, model: "m", catalogo, conversacion: [{ rol: "profesor", texto: "x" }], contexto: ctx });
    assert.equal(r.resultado.accion, "pregunta");
    assert.deepEqual(r.rechazo, input);
  });

  test("EL MONTADOR CON TIPOS CONCRETOS: esos, en ese orden, repetidos si se piden", () => {
    const { soluciones } = montaHoja({ tema: ENTEROS_1ESO,
      objetivo: 3, intensidad: "normal", azar: crearAzar("b"),
      baterias: ["resta_con_parentesis", "resta_con_parentesis", "valor_absoluto", "no_existe"],
    });
    assert.deepEqual(soluciones.map((s) => s.clave), ["resta_con_parentesis", "resta_con_parentesis", "valor_absoluto"]);
    assert.notDeepEqual(soluciones[0].soluciones, soluciones[1].soluciones, "las dos repetidas llevan otros números");
  });
}
