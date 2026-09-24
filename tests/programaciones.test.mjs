import assert from "node:assert/strict";
import fs from "node:fs";

const RAIZ = new URL("../", import.meta.url).pathname;

// RECURSOS → PROGRAMACIÓN: la estructura (unidades, cobertura, pesos) con el
// currículo de verdad, y el guardado (migración 130) con un cliente falso.
export async function run({ test }) {
  const E = await import("../assets/shared/programacion/estructuraDeLaProgramacion.js");
  const { APARTADOS, APARTADOS_DE_TEXTO } = await import("../assets/shared/programacion/apartadosLegales.js");
  const { curriculoDeCurso } = await import("../server/lib/curriculo/curriculoAragon.js");
  const P = await import("../server/lib/programaciones/programaciones.js");
  const { createApp } = await import("../server/app.js");

  test("los 15 apartados del artículo 59.3, en orden, de la a) a la ñ)", () => {
    assert.deepEqual(APARTADOS.map((a) => a.letra), ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "ñ"]);
    assert.equal(APARTADOS_DE_TEXTO.length, 12);
    assert.equal(APARTADOS[0].de, "curriculo");
  });

  test("PROPUESTA: una unidad por bloque de Matemáticas 1.º, con TODO programado y las sesiones del curso", () => {
    const c = curriculoDeCurso("matematicas", 1);
    const total = 4 * 35;
    const unidades = E.propuestaPorBloques(c, { sesionesTotales: total });
    assert.equal(unidades.length, 6);
    assert.equal(unidades[0].titulo, "Sentido numérico");
    const cob = E.cobertura(c, unidades, { sesionesTotales: total });
    assert.equal(cob.completa, true);
    assert.equal(cob.sesiones, total);
    assert.equal(cob.totalCriterios, 23);
    assert.ok(unidades.every((u) => u.trimestre >= 1 && u.trimestre <= 3));
  });

  test("COBERTURA: lo que se quita de todas las unidades aparece como pendiente", () => {
    const c = curriculoDeCurso("matematicas", 1);
    const unidades = E.propuestaPorBloques(c, { sesionesTotales: 100 });
    unidades[0].saberes = unidades[0].saberes.slice(1);
    unidades.forEach((u) => { u.criterios = u.criterios.filter((k) => k !== "1.1"); });
    const cob = E.cobertura(c, unidades);
    assert.equal(cob.completa, false);
    assert.equal(cob.saberesSinUnidad.length, 1);
    assert.equal(cob.saberesSinUnidad[0].apartado, "A.1");
    assert.deepEqual(cob.criteriosSinUnidad.map((k) => k.codigo), ["1.1"]);
  });

  test("VARIANTE: en 4.º, Matemáticas B lleva sus saberes y SOLO sus criterios", () => {
    const c = curriculoDeCurso("matematicas", 4);
    assert.deepEqual(E.variantesDe(c), ["Matemáticas A (4º ESO)", "Matemáticas B (4º ESO)"]);
    const b = E.deLaVariante(c, "Matemáticas B (4º ESO)");
    assert.equal(b.saberes.length, 1);
    const columnas = new Set(E.criteriosDe(b).map((k) => k.columna));
    assert.deepEqual([...columnas], ["Matemáticas B (4º ESO)"]);
    assert.equal(E.deLaVariante(c, null), c);
  });

  test("PESOS: a partes iguales que suman 100", () => {
    const c = curriculoDeCurso("matematicas", 1);
    const pesos = E.pesosIguales(c);
    assert.equal(Object.keys(pesos).length, 10);
    assert.equal(E.sumaDePesos(pesos), 100);
  });

  test("lo que se guarda se valida: unidades acotadas, textos por letra, nada de campos sueltos", () => {
    const bien = { unidades: [{ id: "u1", titulo: "Enteros", trimestre: 1, sesiones: 12, saberes: ["s0.0.0.0"], criterios: ["1.1"] }], pesos: { "CE.M.1": 50 }, textos: { c: "Observación" } };
    assert.equal(P.DatosSchema.safeParse(bien).success, true);
    assert.equal(P.DatosSchema.safeParse({ ...bien, otra: 1 }).success, false);
    assert.equal(P.DatosSchema.safeParse({ unidades: [{ ...bien.unidades[0], trimestre: 4 }] }).success, false);
    assert.equal(P.CabeceraSchema.safeParse({ materia_slug: "../x", curso: 1, titulo: "" }).success, false);
  });

  function falso(respuesta = { data: [], error: null }) {
    const consultas = [];
    const admin = {
      from(tabla) {
        const q = { tabla, pasos: [] };
        consultas.push(q);
        const cadena = new Proxy({}, {
          get(_, nombre) {
            if (nombre === "then") return (ok) => Promise.resolve(respuesta).then(ok);
            return (...args) => { q.pasos.push([nombre, ...args]); return cadena; };
          },
        });
        return cadena;
      },
    };
    return { admin, consultas };
  }
  const tiene = (q, ...paso) => q.pasos.some((p) => JSON.stringify(p) === JSON.stringify(paso));

  test("SOLO LAS SUYAS: listar, leer, guardar y borrar filtran por centro Y por profesor", async () => {
    for (const fn of [
      (a) => P.misProgramaciones({ admin: a, tenantId: "t", userId: "u" }),
      (a) => P.leeProgramacion({ admin: a, tenantId: "t", userId: "u", id: "x" }),
      (a) => P.guardaProgramacion({ admin: a, tenantId: "t", userId: "u", id: "x", datos: {} }),
      (a) => P.borraProgramacion({ admin: a, tenantId: "t", userId: "u", id: "x" }),
    ]) {
      const { admin, consultas } = falso({ data: null, error: null });
      await fn(admin);
      assert.ok(tiene(consultas[0], "eq", "tenant_id", "t"));
      assert.ok(tiene(consultas[0], "eq", "creada_por", "u"));
    }
  });

  test("la migración 130 crea la tabla con RLS", () => {
    const sql = fs.readFileSync(`${RAIZ}supabase/migrations/130_programaciones.sql`, "utf8");
    assert.ok(sql.includes("create table if not exists public.programaciones"));
    assert.ok(sql.includes("enable row level security"));
    assert.ok(sql.includes("datos jsonb not null"));
  });

  for (const r of [
    { method: "GET", url: "/api/v1/recursos/programaciones" },
    { method: "POST", url: "/api/v1/recursos/programaciones" },
    { method: "GET", url: "/api/v1/recursos/programaciones/00000000-0000-4000-8000-000000000000" },
    { method: "PUT", url: "/api/v1/recursos/programaciones/00000000-0000-4000-8000-000000000000" },
    { method: "DELETE", url: "/api/v1/recursos/programaciones/00000000-0000-4000-8000-000000000000" },
  ]) {
    test(`programaciones wiring: ${r.method} ${r.url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject(r);
      await app.close();
      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `recibió ${res.statusCode}`);
    });
  }
}
