import fs from "node:fs";
import path from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname;

// EL AULA NO SABE QUIÉN LA ABRE.
//
// EL PROBLEMA (deuda técnica desde el 07/09, cerrado el 14/09/2026). El diario
// y el horario vivían en `assets/academia/profesor/js/`, y los importaba
// TAMBIÉN el panel de admin, desde "Dar clase":
//
//   import { renderDiario } from "../../../profesor/js/diario.js";
//
// O sea: la carpeta decía "profesor" y dentro estaba media pantalla del admin.
// Eso no es un problema estético — es que el sitio donde se guarda una cosa es
// la primera pista de quién la usa, y esa pista estaba mintiendo. Cualquiera
// (Claude incluido) que tocara algo de `profesor/` creyendo que solo afectaba
// al panel del profesor, rompía "Dar clase" sin enterarse.
//
// AHORA: `assets/academia/aula/js/` —lo que se usa para dar clase: diario,
// horario y sus piezas— y en `profesor/js/` queda solo el armazón del panel
// (`academiaProfesor.js` y `tabsHeader.js`).
//
// ESTE TEST ES LA FRONTERA. El aula puede ser importada por los dos paneles,
// pero no puede importar a ninguno: en cuanto un módulo del aula necesite algo
// del panel del profesor, la separación deja de existir y volvemos al mismo
// sitio con otro nombre.
export async function run({ test, assert }) {
  const AULA = "assets/academia/aula";
  const PROFESOR = "assets/academia/profesor";

  function archivosJs(dir, acc = []) {
    for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) archivosJs(rel, acc);
      else if (e.name.endsWith(".js")) acc.push(rel);
    }
    return acc;
  }

  const RE_IMPORT = /(?:from\s*|import\s*\(\s*)["'](\.[^"']*)["']/g;
  const importesDe = (rel) => {
    const fuente = fs.readFileSync(path.join(RAIZ, rel), "utf8");
    return [...fuente.matchAll(RE_IMPORT)].map((m) =>
      path.normalize(path.join(path.dirname(rel), m[1]))
    );
  };

  const delAula = archivosJs(AULA);

  test("el aula existe y tiene dentro lo que se usa para dar clase", () => {
    assert.ok(delAula.length >= 16, `solo hay ${delAula.length} archivos en el aula`);
    for (const esperado of [
      `${AULA}/js/diario/diario.js`,
      `${AULA}/js/horario/horario.js`,
      `${AULA}/js/api.js`,
    ]) {
      assert.ok(delAula.includes(esperado), `falta ${esperado}`);
    }
  });

  test("FRONTERA: ningún módulo del aula importa nada del panel del profesor", () => {
    const cruces = [];
    for (const rel of delAula) {
      for (const destino of importesDe(rel)) {
        if (destino.startsWith(PROFESOR)) cruces.push(`${rel} -> ${destino}`);
      }
    }
    assert.deepEqual(cruces, [], `el aula no puede depender del panel:\n${cruces.join("\n")}`);
  });

  test("y tampoco del panel de admin", () => {
    const cruces = [];
    for (const rel of delAula) {
      for (const destino of importesDe(rel)) {
        if (destino.startsWith("assets/academia/admin")) cruces.push(`${rel} -> ${destino}`);
      }
    }
    assert.deepEqual(cruces, [], `el aula no puede depender del panel:\n${cruces.join("\n")}`);
  });

  test("en profesor/js solo queda el armazón del panel", () => {
    // Si vuelve a crecer, es que algo compartido se ha guardado otra vez en la
    // carpeta de un solo panel. El aula es el sitio.
    const quedan = fs.readdirSync(path.join(RAIZ, PROFESOR, "js")).sort();
    assert.deepEqual(quedan, ["academiaProfesor.js", "tabsHeader.js"]);
  });

  test("los DOS paneles entran al aula por la misma puerta", () => {
    // Es la prueba de que el movimiento no ha dejado una copia por panel: el
    // diario que pinta "Dar clase" y el que pinta el panel del profesor son el
    // mismo archivo.
    const desdeAdmin = importesDe("assets/academia/admin/js/sections/darClaseSection.js");
    const desdeProfesor = importesDe(`${PROFESOR}/js/tabsHeader.js`);
    for (const modulo of [`${AULA}/js/diario/diario.js`, `${AULA}/js/horario/horario.js`]) {
      assert.ok(desdeAdmin.includes(modulo), `"Dar clase" debe importar ${modulo}`);
      assert.ok(desdeProfesor.includes(modulo), `el panel del profesor debe importar ${modulo}`);
    }
  });
}
