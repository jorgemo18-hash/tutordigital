import assert from "node:assert/strict";
import fs from "node:fs";

const RAIZ = new URL("../", import.meta.url).pathname;

// RECURSOS → PROGRAMACIÓN: la estructura (unidades, cobertura, pesos) con el
// currículo de verdad, y el guardado (migración 130) con un cliente falso.
export async function run({ test }) {
  const E = await import("../assets/shared/programacion/estructuraDeLaProgramacion.js");
  const { apartadosDe, apartadosDeTextoDe, referenciaDe } = await import("../assets/shared/programacion/apartadosLegales.js");
  const { curriculoDeCurso } = await import("../server/lib/curriculo/curriculoAragon.js");
  const P = await import("../server/lib/programaciones/programaciones.js");
  const { createApp } = await import("../server/app.js");

  test("ESO: los 15 apartados del artículo 59.3, en orden, de la a) a la ñ)", () => {
    const eso = apartadosDe("matematicas");
    assert.deepEqual(eso.map((a) => a.letra), ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "ñ"]);
    assert.equal(apartadosDeTextoDe("matematicas").length, 12);
    assert.equal(eso[0].de, "curriculo");
    assert.match(referenciaDe("matematicas"), /59\.3 de la ORDEN ECD\/1172\/2022/);
  });

  test("PRIMARIA (art. 42.3, ECD/1112/2022) de la a) a la n); BACHILLERATO (art. 54.3, ECD/1173/2022) de la a) a la m)", () => {
    const pri = apartadosDe("primaria-matematicas");
    const bach = apartadosDe("bachillerato-fisica");
    assert.deepEqual(pri.map((a) => a.letra).join(""), "abcdefghijklmn");
    assert.deepEqual(bach.map((a) => a.letra).join(""), "abcdefghijklm");
    assert.match(referenciaDe("primaria-matematicas"), /42\.3 de la ORDEN ECD\/1112\/2022.*ECD\/866\/2024/);
    assert.match(referenciaDe("bachillerato-fisica"), /54\.3 de la ORDEN ECD\/1173\/2022/);
    // La h) de Primaria, como la dejó la ECD/866/2024.
    assert.match(pri.find((a) => a.letra === "h").titulo, /situaciones de aprendizaje/);
    // Las letras no significan lo mismo: la g) de Bachillerato es la
    // materia pendiente, que en ESO es la h); Bachillerato no tiene Plan Lector.
    assert.equal(bach.find((a) => a.letra === "g").clave, "pendientes");
    assert.equal(apartadosDe("matematicas").find((a) => a.letra === "h").clave, "pendientes");
    assert.ok(!bach.some((a) => a.clave === "lector"));
    // a, b y d salen del currículo, las unidades y los pesos en las tres.
    for (const lista of [pri, bach]) {
      assert.deepEqual(lista.filter((a) => a.de !== "texto").map((a) => `${a.letra}${a.de}`), ["acurriculo", "bunidades", "dcalificacion"]);
    }
  });

  test("CURSO DE LA ETAPA: 6.º de Primaria sí; 5.º de ESO y 3.º de Bachillerato no", () => {
    const vale = (materia_slug, curso) => P.CabeceraSchema.safeParse({ materia_slug, curso, titulo: "" }).success;
    assert.equal(vale("primaria-matematicas", 6), true);
    assert.equal(vale("matematicas", 4), true);
    assert.equal(vale("matematicas", 5), false);
    assert.equal(vale("bachillerato-matematicas-ii", 2), true);
    assert.equal(vale("bachillerato-matematicas-ii", 3), false);
    assert.equal(vale("primaria-matematicas", 7), false);
  });

  test("MIGRACIÓN 148: la tabla admite los cursos 1-6", () => {
    const sql = fs.readFileSync(`${RAIZ}supabase/migrations/148_programaciones_primaria_bachillerato.sql`, "utf8");
    assert.match(sql, /drop constraint if exists programaciones_curso_check/);
    assert.match(sql, /check \(curso between 1 and 6\)/);
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

  test("PESOS POR CRITERIO: uno por criterio del curso, suman 100, y se agregan por competencia", () => {
    const c = curriculoDeCurso("matematicas", 1);
    const pesos = E.pesosIguales(c, "criterio");
    assert.equal(Object.keys(pesos).length, E.criteriosDe(c).length);
    assert.equal(E.sumaDePesos(pesos), 100);
    const porCe = E.pesoPorCompetencia(c, pesos);
    assert.equal(Math.round(E.sumaDePesos(porCe)), 100);
    assert.equal(E.modoDeCalificacion({ calificacion: "criterio" }), "criterio");
    assert.equal(E.modoDeCalificacion({}), "competencia");
    assert.ok(P.DatosSchema.safeParse({ calificacion: "criterio", pesos }).success);
    assert.ok(!P.DatosSchema.safeParse({ calificacion: "instrumento" }).success, "solo los dos modos");
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

  test("REGRESIÓN: el autor apunta a auth.users, no a profiles (8 de 13 usuarios no tenían perfil y crear daba 500)", () => {
    const sql = fs.readFileSync(`${RAIZ}supabase/migrations/133_autor_de_hojas_y_programaciones.sql`, "utf8");
    for (const t of ["contenido_hojas", "programaciones"]) {
      assert.match(sql, new RegExp(`alter table public\\.${t}\\s+add constraint ${t}_creada_por_fkey\\s+foreign key \\(creada_por\\) references auth\\.users\\(id\\)`));
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
