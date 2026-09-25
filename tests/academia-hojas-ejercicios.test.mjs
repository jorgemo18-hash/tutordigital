import assert from "node:assert/strict";
import fs from "node:fs";

const RAIZ = new URL("../", import.meta.url).pathname;

// EL GENERADOR DE HOJAS EN EL PANEL DE LA ACADEMIA: la ruta y lo que monta.
// Mismo patrón de "wiring" que academia-lista-espera-routes-wiring.test.mjs:
// sin credenciales, se comprueba que las rutas existen y exigen sesión.
export async function run({ test }) {
  const { ENTEROS_1ESO } = await import("../server/lib/generadorEjercicios/temas/enteros1eso.js");
  const { createApp } = await import("../server/app.js");
  const { ROLES, GenerarSchema, ActividadSchema } = await import("../server/routes/v1/academia.hojas-ejercicios.routes.js");
  const { hojaDelPanel, actividadDelPanel, catalogoDelPanel } = await import("../server/lib/generadorEjercicios/hojaDelPanel.js");
  const { TEMAS_CON_GENERADOR } = await import("../server/lib/generadorEjercicios/temasConGenerador.js");
  const TEMA = TEMAS_CON_GENERADOR[0].id;

  for (const ruta of [
    { method: "GET", url: "/api/v1/academia/hojas-ejercicios/catalogo" },
    { method: "POST", url: "/api/v1/academia/hojas-ejercicios/generar" },
    { method: "POST", url: "/api/v1/academia/hojas-ejercicios/actividad" },
    { method: "POST", url: "/api/v1/academia/hojas-ejercicios/interpretar" },
  ]) {
    test(`hojas-ejercicios wiring: ${ruta.method} ${ruta.url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method: ruta.method, url: ruta.url });
      await app.close();
      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth/tenant, recibió ${res.statusCode}`);
    });
  }

  test("EL GASTO DEL PEDIDO EN PALABRAS se apunta con un source que la base de datos admite", async () => {
    // Sin la migración 128 la inserción en ai_token_usage fallaría en
    // silencio (tokenUsage.js nunca lanza) y el gasto se perdería.
    const { SOURCE, InterpretarSchema } = await import("../server/routes/v1/academia.hojas-ejercicios.interpretar.routes.js");
    const sql = fs.readFileSync(`${RAIZ}supabase/migrations/128_token_usage_hojas_interpretar.sql`, "utf8");
    assert.ok(sql.includes(`'${SOURCE}'`));
    const ok = { conversacion: [{ rol: "profesor", texto: "dos de restar" }], contexto: { temaId: TEMA, objetivo: 3, intensidad: "normal" } };
    assert.equal(InterpretarSchema.safeParse(ok).success, true);
    assert.equal(InterpretarSchema.safeParse({ ...ok, conversacion: [] }).success, false);
    assert.equal(InterpretarSchema.safeParse({ ...ok, conversacion: [{ rol: "sistema", texto: "x" }] }).success, false);
    assert.equal(InterpretarSchema.safeParse({ ...ok, conversacion: [{ rol: "profesor", texto: "x".repeat(601) }] }).success, false);
  });

  test("hojas-ejercicios: solo el admin del centro (el panel de academia es de admin)", () => {
    assert.deepEqual(ROLES, ["admin"]);
  });

  // Que cada tema del panel exista en su migración con ese curso, materia y
  // nombre lo comprueba catalogoDeBaterias.test.mjs, tema a tema.

  test("la petición solo admite temas, objetivos e intensidades que existen", () => {
    const ok = { temaId: TEMA, objetivo: 1, intensidad: "normal" };
    assert.equal(GenerarSchema.safeParse(ok).success, true);
    assert.equal(GenerarSchema.safeParse({ ...ok, temaId: "otro" }).success, false);
    assert.equal(GenerarSchema.safeParse({ ...ok, objetivo: 7 }).success, false);
    assert.equal(GenerarSchema.safeParse({ ...ok, intensidad: "extrema" }).success, false);
    assert.equal(GenerarSchema.safeParse({ ...ok, objetivo: "1" }).success, false);
    assert.equal(GenerarSchema.safeParse({ ...ok, semilla: "x".repeat(41) }).success, false);
    assert.equal(GenerarSchema.safeParse({ ...ok, actividades: 6 }).success, true);
    assert.equal(GenerarSchema.safeParse({ ...ok, actividades: 0 }).success, false);
    assert.equal(GenerarSchema.safeParse({ ...ok, actividades: 11 }).success, false);
    assert.equal(ActividadSchema.safeParse({ ...ok, clave: "compara_enteros" }).success, true);
    assert.equal(ActividadSchema.safeParse(ok).success, false, "sin clave no hay ejercicio que cambiar");
    assert.equal(GenerarSchema.safeParse({ ...ok, baterias: ["compara_enteros"] }).success, true);
    assert.equal(GenerarSchema.safeParse({ ...ok, baterias: [] }).success, false);
  });

  test("el catálogo ofrece los temas con sus seis objetivos, cada uno con sus baterías y su nombre", () => {
    const c = catalogoDelPanel();
    // Enteros primero (es el que abre el panel) y los demás en el orden del
    // curso.
    assert.deepEqual(c.temas.map((x) => x.nombre), ["Números enteros", "Números naturales", "Potencias y raíces", "Divisibilidad", "Números decimales", "Sistema métrico decimal", "Fracciones", "Proporcionalidad y porcentajes", "Álgebra"]);
    const [t] = c.temas;
    const d = c.temas.find((x) => x.nombre === "Divisibilidad");
    assert.deepEqual(d.objetivos.map((o) => o.numero), [1, 2, 3, 4, 5, 6]);
    assert.ok(d.objetivos.every((o) => o.titulo && o.maxActividades >= 1 && o.baterias.length >= 1));
    assert.deepEqual([t.curso, t.materia, t.nombre], ["1.º ESO", "Matemáticas", "Números enteros"]);
    assert.deepEqual(t.objetivos.map((o) => o.numero), [1, 2, 3, 4, 5, 6]);
    assert.ok(t.objetivos.every((o) => o.titulo && o.maxActividades >= 1 && o.baterias.length >= 1));
    assert.ok(t.objetivos[0].baterias.some((b) => b.nombre === "Completa con el signo > o <"));
    assert.deepEqual(c.intensidades, ["repaso", "normal", "refuerzo"]);
  });

  test("LA MISMA SEMILLA DA LA MISMA HOJA; otra semilla, otros números; y trae sus huecos", () => {
    const pide = (semilla) => hojaDelPanel({ temaId: TEMA, objetivo: 3, intensidad: "normal", semilla });
    const a = pide("abc");
    assert.deepEqual(a, pide("abc"));
    assert.notDeepEqual(a.hoja.actividades, pide("otra").hoja.actividades);
    assert.equal(a.huecos.length, a.hoja.actividades.length);
    assert.ok(a.huecos.every((h, i) => h.orden === i + 1 && h.clave && h.objetivo));
  });

  test("CON UN NÚMERO PEDIDO, la hoja lleva ese número; pedir de más da lo que hay", async () => {
    const { maxActividades } = await import("../server/lib/generadorEjercicios/montadorDeHoja.js");
    assert.equal(hojaDelPanel({ temaId: TEMA, objetivo: 1, intensidad: "normal", semilla: "s", actividades: 7 }).hoja.actividades.length, 7);
    const cuatro = hojaDelPanel({ temaId: TEMA, objetivo: 4, intensidad: "normal", semilla: "s", actividades: 8 });
    assert.equal(cuatro.hoja.actividades.length, maxActividades(ENTEROS_1ESO, 4));
  });

  test("UN EJERCICIO SUELTO: de la batería pedida, con su ejemplo, y solo del objetivo o su repaso", () => {
    const r = actividadDelPanel({ temaId: TEMA, objetivo: 3, intensidad: "refuerzo", clave: "suma_mismo_signo", semilla: "x" });
    assert.equal(r.hueco.clave, "suma_mismo_signo");
    assert.equal(r.hueco.objetivo, 3);
    assert.equal(r.actividad.apartados[0].resuelto, true, "lleva su ejemplo resuelto");
    const otro = actividadDelPanel({ temaId: TEMA, objetivo: 3, intensidad: "refuerzo", clave: "suma_mismo_signo", semilla: "y" });
    assert.notDeepEqual(r.actividad, otro.actividad, "otra semilla, otros números");
    // De repaso (objetivo anterior) sí; de un objetivo posterior, no.
    assert.equal(actividadDelPanel({ temaId: TEMA, objetivo: 3, intensidad: "normal", clave: "valor_absoluto", semilla: "x" }).hueco.esRepaso, true);
    assert.equal(actividadDelPanel({ temaId: TEMA, objetivo: 3, intensidad: "normal", clave: "combinada_un_nivel", semilla: "x" }), null);
  });

  test("la cabecera dice materia, curso, tema y el título del objetivo", () => {
    const { hoja } = hojaDelPanel({ temaId: TEMA, objetivo: 2, intensidad: "repaso", semilla: "s" });
    assert.deepEqual([hoja.materia, hoja.curso, hoja.tema, hoja.objetivo],
      ["Matemáticas", "1.º ESO", "Números enteros", "Valor absoluto y opuesto"]);
  });
}
