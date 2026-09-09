import fs from "node:fs";

// La regla `no-undef` tiene que seguir activa.
//
// POR QUÉ HAY UN TEST PARA UNA REGLA DE LINTER. El 09/09/2026 se separó
// /summary del cuaderno a su propio archivo: el handler se movió y tres
// funciones que usa se quedaron en el archivo viejo. El archivo nuevo las
// llamaba sin tenerlas, así que `GET /api/v1/notebook/summary` lanzaba un
// ReferenceError y devolvía 500 — y llegó a producción.
//
// No lo cazó nada de lo que había:
//   - `node --check` solo valida la SINTAXIS, y llamar a algo que no existe
//     es sintaxis perfectamente válida;
//   - los tests no ejercitan esa ruta;
//   - el smoke de UI mockea la API;
//   - y ESLint solo tenía activadas `max-lines` y la de escHtml.
//
// Un identificador inexistente no falla al cargar el módulo: falla cuando
// esa línea concreta se ejecuta, que pueden ser semanas después y en
// producción. Al activar la regla apareció además un segundo fallo real, en
// el chat del alumno (`storedCourse` en send.js, que se calculaba en otro
// módulo y aquí se leía como si estuviera en el ámbito).
//
// Es la regla más barata que existe contra el fallo más caro de encontrar.
// Este test impide que alguien la quite para "arreglar" un rojo del linter.
export async function run({ test, assert }) {
  const config = fs.readFileSync(new URL("../eslint.config.js", import.meta.url), "utf8");

  test("REGRESIÓN: no-undef sigue en error, no en warn ni apagada", () => {
    assert.match(
      config, /"no-undef":\s*"error"/,
      "sin esta regla, una función que no existe llega a producción sin que nada avise"
    );
  });

  test("y los globals están declarados, que es lo que la hace usable", () => {
    // Sin globals, `no-undef` marca `document`, `process` y compañía en cada
    // archivo, y el ruido acaba con que alguien apague la regla.
    assert.match(config, /globals\.node/);
    assert.match(config, /globals\.browser/);
  });

  test("los globales de terceros se declaran uno a uno, no con un comodín", () => {
    // KaTeX se carga por <script> y no es importable, así que hay que
    // declararlo. Lo que no puede pasar es que se relaje la regla entera
    // para que quepa el siguiente: cada tercero, su línea.
    assert.match(config, /katex:\s*"readonly"/);
    assert.match(config, /renderMathInElement:\s*"readonly"/);
  });

  test("REGRESIÓN: las piezas del resumen del cuaderno se importan, no se asumen", () => {
    // El fallo concreto que motivó todo esto.
    const src = fs.readFileSync(
      new URL("../server/routes/v1/notebookSummary.routes.js", import.meta.url), "utf8"
    );
    assert.match(src, /import \{[^}]*statusForSummary[^}]*\} from "\.\.\/\.\.\/lib\/notebook\/resumen\.js"/);
    for (const fn of ["toIsoDateStart", "toIsoDateEnd", "statusForSummary"]) {
      assert.match(src, new RegExp(`${fn}\\(`), `${fn} ya no se usa: revisa si el import sobra`);
    }
  });
}
