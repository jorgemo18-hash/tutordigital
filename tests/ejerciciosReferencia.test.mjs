import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// LOS EJERCICIOS DE REFERENCIA (server/lib/ejerciciosReferencia/): cada archivo
// con su forma, cada saber del currículo de Aragón de SU curso, y las
// soluciones de Matemáticas ya comprobadas por tools/referencias/comprueba.py.
const RAIZ = new URL("../server/lib/ejerciciosReferencia/datos/", import.meta.url).pathname;

function archivos(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? archivos(p) : f.endsWith(".json") ? [p] : [];
  });
}

export async function run({ test }) {
  const { TemaSchema } = await import("../server/lib/ejerciciosReferencia/esquema.js");
  const { curriculoDeCurso } = await import("../server/lib/curriculo/curriculoAragon.js");
  const { slugConEtapa } = await import("../assets/shared/curriculo/etapas.js");
  const R = await import("../server/lib/ejerciciosReferencia/referencias.js");
  const todos = archivos(RAIZ).map((ruta) => ({ ruta, datos: JSON.parse(readFileSync(ruta, "utf8")) }));

  test("hay referencias, y cada archivo tiene la forma del esquema y está en su carpeta", () => {
    assert.ok(todos.length >= 1);
    for (const { ruta, datos } of todos) {
      const r = TemaSchema.safeParse(datos);
      assert.ok(r.success, `${ruta}: ${JSON.stringify(r.error?.issues?.slice(0, 3))}`);
      assert.ok(ruta.endsWith(`/${datos.etapa}/${datos.materia}/${datos.curso}/${datos.tema}.json`), `${ruta}: carpeta y datos no coinciden`);
    }
  });

  test("CURRÍCULO DE ARAGÓN: cada saber existe en ESE curso (no nos fiamos de la fuente)", () => {
    for (const { ruta, datos } of todos) {
      const c = curriculoDeCurso(slugConEtapa(datos.etapa, datos.materia), datos.curso);
      assert.ok(c, `${ruta}: la materia no está en el currículo`);
      const codigos = new Set(c.saberes.flatMap((s) => s.bloques.flatMap((b) => b.apartados.map((a) => a.codigo))));
      for (const s of datos.saberes) assert.ok(codigos.has(s), `${ruta}: el saber ${s} no está en ${datos.curso}.º`);
      for (const e of datos.ejercicios) for (const s of e.saberes) assert.ok(codigos.has(s), `${e.id}: el saber ${s} no está en ${datos.curso}.º`);
    }
  });

  test("SOLUCIONES: lo que se puede comprobar está comprobado; cada ejercicio cita una fuente del archivo; ids únicos", () => {
    const ids = new Set();
    for (const { datos } of todos) {
      for (const e of datos.ejercicios) {
        assert.ok(!ids.has(e.id), `id repetido: ${e.id}`);
        ids.add(e.id);
        assert.ok(datos.fuentes[e.fuente], `${e.id}: fuente ${e.fuente} sin describir`);
        if (e.comprobar) assert.equal(e.verificacion, "comprobada", `${e.id}: pasa tools/referencias/comprueba.py`);
      }
    }
  });

  test("LECTURA: temas de un curso, un tema, y los ejercicios de un saber con variedad de tipos", () => {
    const donde = { etapa: "eso", materia: "matematicas", curso: 2 };
    const temas = R.temasConReferencias(donde);
    assert.ok(temas.some((t) => t.tema === "ecuaciones-primer-grado"));
    assert.equal(R.referenciasDelTema({ ...donde, tema: "ecuaciones-primer-grado" }).titulo, "Ecuaciones de primer grado");
    const d4 = R.referenciasDelSaber({ ...donde, saber: "D.4", max: 6 });
    assert.equal(d4.length, 6);
    assert.ok(new Set(d4.map((e) => e.tipo)).size >= 4, "de tipos distintos, no seis del mismo");
    assert.ok(d4.every((e) => e.saberes.includes("D.4")));
    // Nombres raros no leen fuera de la carpeta.
    assert.equal(R.referenciasDelTema({ ...donde, tema: "../../x" }), null);
    assert.deepEqual(R.temasConReferencias({ etapa: "..", materia: "x", curso: 1 }), []);
  });
}
