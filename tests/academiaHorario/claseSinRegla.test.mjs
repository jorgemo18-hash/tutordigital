import fs from "node:fs";
import path from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname;

// NINGUNA CLASE DE LA CELDA DEL CUADRANTE SE QUEDA SIN REGLA DE CSS.
//
// EL PROBLEMA (en la lista de deuda técnica desde el 07/09, cerrado el
// 14/09/2026). `horarioCelda.js` ponía `.ac-slots` al contenedor de los
// alumnos de la hora, y el comentario de al lado mandaba a leer esa clase en
// el CSS para entender que los alumnos van "a DOS COLUMNAS cuando la celda es
// ancha". **La clase no existía en ninguna hoja** y las dos columnas se habían
// descartado (obligaban a ensanchar el cuadrante a 1.760 px contra los 1.040
// del resto del panel).
//
// O sea: una clase que no pintaba nada y un comentario que mandaba a buscarla.
// Lo caro de esto no es la clase: es el rato que pierde el siguiente que lea
// el comentario, abra el CSS y no encuentre nada, y tenga que decidir si el
// fallo es que falta la regla o que sobra el comentario.
//
// ESTE TEST ES LA GUARDA, no el arreglo: barre las clases que el módulo pone
// de verdad y exige que cada una tenga al menos una regla. Vale para la
// próxima, que es de lo que se trata.
export async function run({ test, assert }) {
  const MODULO = "assets/academia/aula/js/horario/horarioCelda.js";

  // Clases que se asignan en el módulo. Se lee la ASIGNACIÓN (`className =`),
  // no cualquier aparición del texto: los comentarios de este repo nombran
  // clases constantemente y un test que lea prosa se dispara con ellos (pasó
  // tres veces la semana del 11/09).
  const fuente = fs.readFileSync(`${RAIZ}${MODULO}`, "utf8");
  const codigo = fuente.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

  const clases = new Set();
  for (const m of codigo.matchAll(/className\s*=\s*(?:`([^`]*)`|"([^"]*)")/g)) {
    const literal = m[1] ?? m[2] ?? "";
    // De `ac-lv ${nivelInfo(...).cls}` sale "ac-lv": lo interpolado es una
    // clase que decide otro módulo y se comprueba en su propio test.
    for (const trozo of literal.replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) {
      const clase = trozo.trim();
      if (clase) clases.add(clase);
    }
  }

  // Todas las hojas del proyecto: la celda se pinta desde el panel del
  // profesor Y desde "Dar clase" en el de admin, y su CSS es el compartido.
  function hojasDeCss(dir, acc = []) {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completa = path.join(dir, entrada.name);
      if (entrada.isDirectory()) hojasDeCss(completa, acc);
      else if (entrada.name.endsWith(".css")) acc.push(completa);
    }
    return acc;
  }
  const css = hojasDeCss(`${RAIZ}assets`).map((f) => fs.readFileSync(f, "utf8")).join("\n");

  test("el módulo asigna las clases que creemos (si no, el barrido no vale)", () => {
    assert.ok(clases.size >= 10, `solo se han encontrado ${clases.size} clases: ¿ha cambiado la forma de asignarlas?`);
    for (const esperada of ["ac-cell", "ac-slot", "ac-slot-name", "ac-sueltas"]) {
      assert.ok(clases.has(esperada), `falta ${esperada}: el barrido no está leyendo el módulo`);
    }
  });

  test("REGRESIÓN: ninguna clase de la celda se queda sin regla", () => {
    const huerfanas = [...clases].filter(
      (clase) => !new RegExp("\\." + clase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![-\\w])").test(css)
    );
    assert.deepEqual(
      huerfanas, [],
      `clases sin ni una regla de CSS: ${huerfanas.join(", ")} — o se escribe la regla o se quita la clase`
    );
  });

  test("REGRESIÓN: y .ac-slots no vuelve", () => {
    // La que originó esto. Si alguien la repone, será con su regla o con este
    // test en rojo.
    assert.equal(
      clases.has("ac-slots"), false,
      "el contenedor de los alumnos de la hora va sin clase: ver el comentario de buildCell"
    );
  });

  test("el contenedor de los alumnos de la hora sigue existiendo", () => {
    // Es lo que impide que el `gap: 6px` de .ac-cell se abra entre cada dos
    // nombres. Quitar el div (y no solo su clase) cambiaría el alto de todas
    // las celdas del cuadrante.
    assert.match(codigo, /if \(dentro\.length\) \{\s*const lista = document\.createElement\("div"\);/);
    assert.match(codigo, /cell\.appendChild\(lista\)/);
  });
}
