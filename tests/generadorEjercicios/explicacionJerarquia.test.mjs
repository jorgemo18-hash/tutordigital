// EL DESARROLLO DE UNA OPERACIÓN COMBINADA, paso a paso.
//
// Lo único delicado de esta pieza es EL ORDEN DE LOS PASOS, y ahí me
// equivoqué en la primera versión: reduciendo el árbol por la izquierda en
// profundidad, `4 - 6 - (6 - 8)` hacía `4 - 6` ANTES del paréntesis. El
// resultado final salía bien.
//
// Y eso es exactamente lo que hace el fallo peligroso: un desarrollo que
// llega al número correcto por un procedimiento incorrecto es peor que no
// poner desarrollo, porque el alumno copia el procedimiento.
export async function run({ test, assert }) {
  const { pasosDeJerarquia, explicaJerarquia } = await import(
    "../../server/lib/generadorEjercicios/explicacionJerarquia.js"
  );
  const { por, entre, resta, suma, neg, evaluar, render } = await import(
    "../../server/lib/generadorEjercicios/expresion.js"
  );

  // Los desarrollos se escriben con el menos tipográfico (−, U+2212) y no con
  // el guion, porque la explicación es texto plano y el carácter que se pone
  // es el que se imprime. En las expectativas de abajo se normaliza para que
  // se puedan leer; que el glifo sea el correcto lo comprueba su propio test.
  const conGuion = (s) => String(s).replace(/\u2212/g, "-");
  const pasos = (arbol) => pasosDeJerarquia(arbol).map(conGuion);

  test("EL PARÉNTESIS VA PRIMERO, aunque quede a la derecha de la expresión", () => {
    // La regresión. En `4 - 6 - (6 - 8)` el primer paso tiene que resolver el
    // paréntesis, no la resta de la izquierda.
    const e = resta(resta(4, 6), resta(6, 8));
    const etapas = pasos(e);
    assert.equal(etapas[0], "4 - 6 - (-2)", `el primer paso fue "${etapas[0]}"`);
    assert.equal(etapas[etapas.length - 1], "0");
  });

  test("lo de MÁS DENTRO va antes que lo de fuera, con dos niveles", () => {
    // `2 · [4 - 3 · (-10 + 12) - (6 - 8)]`: el primer paso es el paréntesis
    // interior, que está dos niveles adentro.
    const e = por(2, resta(resta(4, por(3, suma(-10, 12))), resta(6, 8)));
    const etapas = pasos(e);
    assert.equal(etapas[0], "2 · [4 - 3 · 2 - (6 - 8)]", `el primer paso fue "${etapas[0]}"`);
    assert.equal(etapas[etapas.length - 1], "0");
  });

  test("CON paréntesis se dice el paréntesis, y SIN paréntesis el producto", () => {
    // Las dos mitades del mismo encabezado. La primera versión del test solo
    // comprobaba la mitad de "sin paréntesis", así que quitar la rama del
    // paréntesis no hacía fallar nada: la frase caía a la del producto y
    // seguía siendo cierta para el caso que el test miraba.
    const conGrupo = suma(por(resta(10, 4), 4), 11);
    assert.ok(
      /Primero lo de dentro del paréntesis/.test(explicaJerarquia(conGrupo, 35)),
      explicaJerarquia(conGrupo, 35),
    );
    const dosNiveles = por(2, resta(resta(4, por(3, suma(-10, 12))), resta(6, 8)));
    assert.ok(
      /Primero lo de dentro del paréntesis/.test(explicaJerarquia(dosNiveles, 0)),
      explicaJerarquia(dosNiveles, 0),
    );
  });

  test("sin paréntesis manda el producto, y se dice eso y no otra cosa", () => {
    // `8 - 2 · 3` no tiene ningún paréntesis. La primera versión del
    // despachador lo explicaba con "el menos de delante cambia el signo de
    // todo lo que hay dentro del paréntesis", que además de falso enseña a
    // buscar algo que no está en el papel.
    const e = resta(8, por(2, 3));
    assert.equal(pasos(e)[0], "8 - 6");
    const frase = explicaJerarquia(e, 2);
    assert.ok(/aprietan más que la suma/.test(frase), frase);
    assert.equal(/paréntesis/.test(frase), false, `no hay paréntesis: "${frase}"`);
  });

  test("CADA PASO RESUELVE UNA OPERACIÓN, ni más ni una menos", () => {
    // Invariante fuerte: el número de etapas es el número de operaciones del
    // árbol. Si un paso resolviera dos a la vez, el desarrollo se saltaría
    // justo lo que tiene que enseñar; si resolviera media, no terminaría.
    const CASOS = [
      resta(8, por(2, 3)),
      suma(por(resta(10, 4), 4), 11),
      por(2, resta(resta(4, por(3, suma(-10, 12))), resta(6, 8))),
      entre(-18, por(-3, -2)),
      resta(resta(4, 6), resta(6, 8)),
      por(resta(5, 9), suma(2, 3)),
    ];
    const cuentaOperadores = (n) =>
      (n.tipo === "num" ? 0
        : n.tipo === "neg" ? cuentaOperadores(n.hijo)
          : 1 + cuentaOperadores(n.izq) + cuentaOperadores(n.der));

    for (const e of CASOS) {
      const pasos = pasosDeJerarquia(e);
      assert.equal(
        pasos.length,
        cuentaOperadores(e),
        `${render(e)}: ${pasos.length} pasos para ${cuentaOperadores(e)} operaciones`,
      );
    }
  });

  test("el último paso ES la solución, y si no, no se imprime nada", () => {
    // La comprobación que impide publicar un razonamiento que lleva a otro
    // número: más vale un ejemplo sin explicación que uno que contradice al
    // propio folio.
    const e = suma(por(resta(10, 4), 4), 11);
    const { valor } = evaluar(e);
    assert.equal(pasos(e)[2], String(valor));
    assert.equal(explicaJerarquia(e, valor + 1), null, "con otra solución no debe explicar");
  });

  test("el menos unario delante de un grupo también se desarrolla", () => {
    const e = por(3, neg(resta(-5, 4)));
    const { valor } = evaluar(e);
    assert.equal(valor, 27);
    const etapas = pasos(e);
    assert.equal(etapas[etapas.length - 1], "27", etapas.join(" = "));
  });

  test("EL MENOS ES UN MENOS, NO UN GUION, también en los desarrollos", () => {
    // La explicación es texto plano: no pasa por KaTeX, así que el carácter
    // que se escribe es el que se imprime. En el folio se veía la mezcla de
    // los dos glifos en la misma hoja — las explicaciones de signos con `−` y
    // las de jerarquía con `-`, porque estas salen de `render()`, que usa el
    // guion (lo correcto para un log o un test, no para el papel).
    const e = resta(resta(4, 6), resta(6, 8));
    const crudos = pasosDeJerarquia(e);
    assert.ok(crudos[0].includes("\u2212"), `sin menos tipográfico: "${crudos[0]}"`);
    assert.equal(crudos[0].includes("-"), false, `lleva guion ASCII: "${crudos[0]}"`);
    const frase = explicaJerarquia(e, 0);
    assert.equal(frase.includes("-"), false, `la frase lleva guion ASCII: "${frase}"`);
  });

  test("una expresión que ya es un número no tiene pasos", () => {
    assert.deepEqual(pasosDeJerarquia({ tipo: "num", valor: 5 }), []);
    assert.equal(explicaJerarquia({ tipo: "num", valor: 5 }, 5), null);
  });
}
