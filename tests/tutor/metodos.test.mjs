// LOS PASOS DE CADA TIPO DE EJERCICIO: que cuadren con el generador y con el
// catálogo de errores, y que respeten las reglas del formato.
import { readFileSync } from "node:fs";

export async function run({ test, assert }) {
  const { temasConMetodo, metodoDe } = await import("../../server/lib/tutor/metodos/catalogo.js");
  const { MetodosDelTemaSchema, FORMAS } = await import("../../server/lib/tutor/metodos/esquema.js");
  const { TEMAS_CON_GENERADOR } = await import("../../server/lib/generadorEjercicios/temasConGenerador.js");

  const generadorDe = (id) => TEMAS_CON_GENERADOR.find((t) => t.id === id);
  const clavesDelGenerador = (t) => Object.values(t.baterias).flat().map((b) => b.clave);
  const sqlDe = (t) => [...new Set(Object.values(t.migraciones).flat())]
    .map((m) => readFileSync(new URL(`../../supabase/migrations/${m}`, import.meta.url), "utf8")).join("\n");
  const idDeError = (t, n) => t.idDeConcepto(n).replace(/^c1/, "c2");

  for (const metodos of temasConMetodo()) {
    const gen = generadorDe(metodos.tema);

    test(`${gen?.nombre ?? metodos.tema}: el tema existe en el generador`, () => {
      assert.ok(gen, "tema sin generador");
    });
    if (!gen) continue;

    test(`${gen.nombre}: cada batería del generador tiene su método, y no sobra ninguno`, () => {
      assert.deepEqual(Object.keys(metodos.porClave).sort(), clavesDelGenerador(gen).sort());
    });

    test(`${gen.nombre}: cada error citado existe en la migración del tema`, () => {
      const sql = sqlDe(gen);
      const citados = new Set([...metodos.erroresDeCualquierPaso,
        ...Object.values(metodos.porClave).flatMap((m) => m.hitos.flatMap((h) => h.errores))]);
      for (const n of citados) assert.ok(sql.includes(`'${idDeError(gen, n)}'`), `error ${n} (${idDeError(gen, n)}) no está sembrado`);
    });

    test(`${gen.nombre}: dentro de un método no se repite el id de un hito`, () => {
      for (const [clave, m] of Object.entries(metodos.porClave)) {
        const ids = m.hitos.map((h) => h.id);
        assert.equal(new Set(ids).size, ids.length, clave);
      }
    });
  }

  test("el formato rechaza lo que no debe: dos preguntas en la pista, cinco hitos, una forma inventada", () => {
    const hito = { id: "a", alumno: "Deja la x sola", termina: "x_despejada", errores: [], pista: "¿Qué estorba a la x?" };
    const tema = (porClave) => ({ tema: "c0000000-0000-4000-8000-000000000005", erroresDeCualquierPaso: [], porClave });
    assert.equal(MetodosDelTemaSchema.safeParse(tema({ k: { hitos: [hito] } })).success, true);
    assert.equal(MetodosDelTemaSchema.safeParse(tema({ k: { hitos: [{ ...hito, pista: "¿Qué estorba? ¿Y por qué?" }] } })).success, false);
    assert.equal(MetodosDelTemaSchema.safeParse(tema({ k: { hitos: Array(5).fill(hito) } })).success, false);
    assert.equal(MetodosDelTemaSchema.safeParse(tema({ k: { hitos: [{ ...hito, termina: "inventada" }] } })).success, false);
    assert.ok(FORMAS.x_despejada);
  });

  test("metodoDe: devuelve los hitos y los errores comunes; null si no hay método", () => {
    const m = metodoDe({ tema: "c0000000-0000-4000-8000-000000000005", clave: "ecuacion_con_parentesis" });
    assert.deepEqual(m.hitos.map((h) => h.termina), ["sin_parentesis", "x_en_un_lado", "x_despejada"]);
    assert.deepEqual(m.erroresDeCualquierPaso, [10, 11]);
    assert.equal(metodoDe({ tema: "c0000000-0000-4000-8000-000000000005", clave: "no_existe" }), null);
    assert.equal(metodoDe({ tema: "otro", clave: "ecuacion_con_parentesis" }), null);
  });
}
