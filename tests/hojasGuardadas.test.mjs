import assert from "node:assert/strict";
import fs from "node:fs";

const RAIZ = new URL("../", import.meta.url).pathname;

// LAS HOJAS GUARDADAS CON SU CÓDIGO (paso 2 de Recursos, migración 129).
// La base de datos se sustituye por un cliente falso que apunta lo que le
// piden y contesta lo que le digamos.
export async function run({ test }) {
  const { siguienteCodigo, prefijoDelDia, diaEnEspana } = await import("../server/lib/hojasGuardadas/codigoDelDia.js");
  const { guardaHoja, hojasRecientes, abreHoja, REINTENTOS } = await import("../server/lib/hojasGuardadas/hojasGuardadas.js");
  const { GuardarSchema } = await import("../server/routes/v1/hojas/rutasDeHojasGuardadas.js");
  const { TEMAS_CON_GENERADOR } = await import("../server/lib/generadorEjercicios/temasConGenerador.js");
  const { createApp } = await import("../server/app.js");
  const TEMA = TEMAS_CON_GENERADOR[0].id;

  // Un cliente de Supabase falso: cada consulta es una cadena de llamadas;
  // `responder(consulta)` decide qué devuelve.
  function falso(responder) {
    const consultas = [];
    const admin = {
      from(tabla) {
        const q = { tabla, pasos: [] };
        consultas.push(q);
        const cadena = new Proxy({}, {
          get(_, nombre) {
            if (nombre === "then") return (ok, ko) => Promise.resolve(responder(q)).then(ok, ko);
            return (...args) => { q.pasos.push([nombre, ...args]); return cadena; };
          },
        });
        return cadena;
      },
    };
    return { admin, consultas };
  }
  const paso = (q, nombre) => q.pasos.find((p) => p[0] === nombre);

  test("EL CÓDIGO ES EL DÍA DE ESPAÑA, no el del servidor: las 00:30 del 24 en Madrid son del 24", () => {
    const casi = new Date("2026-09-23T22:30:00Z"); // 00:30 del 24 en Madrid (UTC+2)
    assert.equal(prefijoDelDia(casi), "H-260924-");
    assert.equal(diaEnEspana(casi).getDate(), 24);
  });

  test("el siguiente código del día sigue al mayor, aunque falten números; los de otros días no cuentan", () => {
    const hoy = new Date("2026-09-23T10:00:00Z");
    assert.equal(siguienteCodigo([], hoy), "H-260923-01");
    assert.equal(siguienteCodigo(["H-260923-01", "H-260923-04", "H-260922-09"], hoy), "H-260923-05");
  });

  const HOJA = { objetivo: "Sumar y restar", materia: "Matemáticas", curso: "1.º ESO", tema: "Enteros", centro: "IES", actividades: [{ enunciado: "A" }] };
  const PARAMS = { temaId: TEMA, objetivo: 3, intensidad: "normal" };

  test("GUARDAR: la hoja tal cual, con el código dentro del contenido, del centro y del profesor", async () => {
    const { admin, consultas } = falso((q) => (paso(q, "insert")
      ? { data: { id: "h1", codigo: paso(q, "insert")[1].codigo }, error: null }
      : { data: [{ codigo: "H-260923-01" }], error: null }));
    const r = await guardaHoja({ admin, tenantId: "t1", userId: "u1", hoja: HOJA, huecos: [{ orden: 1, clave: "a", objetivo: 3 }], parametros: PARAMS, ahora: new Date("2026-09-23T10:00:00Z") });
    assert.equal(r.codigo, "H-260923-02");
    const fila = paso(consultas.at(-1), "insert")[1];
    assert.equal(fila.tenant_id, "t1");
    assert.equal(fila.creada_por, "u1");
    assert.equal(fila.contenido.codigo, "H-260923-02");
    assert.equal(fila.objetivo, "Sumar y restar");
    assert.deepEqual(fila.parametros, PARAMS);
    assert.deepEqual(paso(consultas[0], "eq"), ["eq", "tenant_id", "t1"], "los códigos se cuentan por centro");
  });

  test("DOS A LA VEZ: si el código ya lo cogió otro (23505), se reintenta con el siguiente", async () => {
    let inserciones = 0;
    const { admin } = falso((q) => {
      if (!paso(q, "insert")) return { data: inserciones ? [{ codigo: "H-260923-01" }] : [], error: null };
      inserciones += 1;
      return inserciones === 1
        ? { data: null, error: { code: "23505" } }
        : { data: { id: "h2", codigo: paso(q, "insert")[1].codigo }, error: null };
    });
    const r = await guardaHoja({ admin, tenantId: "t", userId: "u", hoja: HOJA, huecos: [], parametros: PARAMS, ahora: new Date("2026-09-23T10:00:00Z") });
    assert.equal(r.codigo, "H-260923-02");
    assert.equal(inserciones, 2);
  });

  test("otro error de la base de datos no se reintenta; y los reintentos tienen tope", async () => {
    const { admin } = falso((q) => (paso(q, "insert") ? { data: null, error: { code: "42501", message: "no" } } : { data: [], error: null }));
    await assert.rejects(guardaHoja({ admin, tenantId: "t", userId: "u", hoja: HOJA, huecos: [], parametros: PARAMS }), (e) => e.code === "42501");
    let n = 0;
    const siempre = falso((q) => { if (paso(q, "insert")) { n += 1; return { data: null, error: { code: "23505" } }; } return { data: [], error: null }; });
    await assert.rejects(guardaHoja({ admin: siempre.admin, tenantId: "t", userId: "u", hoja: HOJA, huecos: [], parametros: PARAMS }));
    assert.equal(n, REINTENTOS);
  });

  test("RECIENTES: solo las del profesor en su centro, nuevas primero; ABRIR: solo del centro", async () => {
    const { admin, consultas } = falso(() => ({ data: [], error: null }));
    await hojasRecientes({ admin, tenantId: "t", userId: "u" });
    const q = consultas[0];
    assert.ok(q.pasos.some((p) => p[0] === "eq" && p[1] === "creada_por" && p[2] === "u"));
    assert.ok(q.pasos.some((p) => p[0] === "eq" && p[1] === "tenant_id" && p[2] === "t"));
    assert.deepEqual(paso(q, "order"), ["order", "created_at", { ascending: false }]);
    const otro = falso(() => ({ data: null, error: null }));
    assert.equal(await abreHoja({ admin: otro.admin, tenantId: "t", id: "x" }), null);
    assert.ok(otro.consultas[0].pasos.some((p) => p[0] === "eq" && p[1] === "tenant_id" && p[2] === "t"));
  });

  test("lo que se guarda se valida: con actividades, sin pasarse del máximo, con los parámetros del generador", () => {
    const bien = { hoja: HOJA, huecos: [{ orden: 1, clave: "a", objetivo: 3, concepto: "x" }], parametros: PARAMS };
    assert.equal(GuardarSchema.safeParse(bien).success, true);
    assert.equal(GuardarSchema.safeParse({ ...bien, hoja: { ...HOJA, actividades: [] } }).success, false);
    assert.equal(GuardarSchema.safeParse({ ...bien, hoja: { ...HOJA, actividades: Array(11).fill({}) } }).success, false);
    assert.equal(GuardarSchema.safeParse({ ...bien, parametros: { ...PARAMS, temaId: "otro" } }).success, false);
    assert.equal(GuardarSchema.safeParse({ ...bien, hoja: { ...HOJA, actividades: [{ enunciado: "x".repeat(400000) }] } }).success, false);
  });

  test("la migración 129 añade las tres columnas que se escriben", () => {
    const sql = fs.readFileSync(`${RAIZ}supabase/migrations/129_contenido_hojas_generadas.sql`, "utf8");
    for (const c of ["contenido jsonb", "huecos jsonb", "parametros jsonb"]) assert.ok(sql.includes(`add column if not exists ${c}`), c);
  });

  for (const ruta of [
    { method: "POST", url: "/api/v1/recursos/hojas/guardar" },
    { method: "GET", url: "/api/v1/recursos/hojas/recientes" },
    { method: "GET", url: "/api/v1/recursos/hojas/guardadas/00000000-0000-4000-8000-000000000000" },
  ]) {
    test(`hojas guardadas wiring: ${ruta.method} ${ruta.url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject(ruta);
      await app.close();
      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `recibió ${res.statusCode}`);
    });
  }
}
