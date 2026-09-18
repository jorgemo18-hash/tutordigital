// LA SECUENCIA PLANA Y SUS DOS MANERAS DE EVALUARLA.
//
// Existe para poder comprobar la instrucción más exigente del catálogo:
// *"si da lo mismo operar de izquierda a derecha, el ejercicio no sirve"*.
// Un árbol lleva la jerarquía dentro, así que evaluarlo da siempre el
// resultado correcto; para saber si el orden importa hay que calcular también
// el equivocado.
export async function run({ test, assert }) {
  const { arbolDeSecuencia, valorDeIzquierdaADerecha, elOrdenImporta } = await import(
    "../../server/lib/generadorEjercicios/secuencia.js"
  );
  const { evaluar, render } = await import("../../server/lib/generadorEjercicios/expresion.js");

  const val = (piezas) => evaluar(arbolDeSecuencia(piezas)).valor;

  test("EL ÁRBOL RESPETA LA JERARQUÍA, comprobado contra el propio JavaScript", () => {
    // Se compara con `eval` sobre la misma expresión escrita con operadores
    // de JavaScript, que tiene exactamente la misma jerarquía. Es una segunda
    // opinión independiente: si nuestra construcción del árbol se equivocara,
    // los dos números no coincidirían.
    const CASOS = [
      [4, "+", 5, "-", 6, "·", 2, "+", 7],
      [2, "+", 3, "·", 4],
      [2, "·", 3, "+", 4],
      [20, ":", 5, "+", 3],
      [1, "+", 2, "·", 3, "-", 4, ":", 2],
      [-5, "·", 3, "+", 10, "-", 2, "·", 4],
    ];
    for (const piezas of CASOS) {
      const enJs = piezas
        .map((p) => (p === "·" ? "*" : p === ":" ? "/" : String(p)))
        .join(" ");
      // eslint-disable-next-line no-eval
      assert.equal(val(piezas), eval(enJs), `${render(arbolDeSecuencia(piezas))} frente a ${enJs}`);
    }
  });

  test("de izquierda a derecha da OTRA cosa, y es el error que se quiere provocar", () => {
    assert.equal(val([2, "+", 3, "·", 4]), 14);
    assert.equal(valorDeIzquierdaADerecha([2, "+", 3, "·", 4]), 20);
  });

  test("sin producto ni cociente, el orden NO importa: no hay jerarquía que aplicar", () => {
    // Una cadena de sumas y restas se opera de izquierda a derecha, así que
    // "el camino equivocado" es el correcto. Esas secuencias no valen para
    // esta batería (valen para la de cadenas, que es otro objetivo).
    const piezas = [8, "-", 3, "+", 2];
    assert.equal(elOrdenImporta(piezas, val(piezas)), false);
  });

  test("EL CASO TRAMPA: una combinada donde los dos caminos coinciden", () => {
    // `2 + 3 + 4 · 1` da 9 por los dos lados, así que el alumno que no sabe
    // la jerarquía lo acierta igual y la hoja no se entera. Parece una
    // combinada y no mide nada.
    const trampa = [2, "+", 3, "+", 4, "·", 1];
    assert.equal(val(trampa), 9);
    assert.equal(valorDeIzquierdaADerecha(trampa), 9);
    assert.equal(elOrdenImporta(trampa, 9), false, "esta secuencia no debería valer");

    // Y otra: multiplicar por 1 al final nunca cambia nada.
    const otra = [5, "-", 2, "·", 1];
    assert.equal(elOrdenImporta(otra, val(otra)), false);
  });

  test("una división no exacta por el camino equivocado también cuenta", () => {
    // `7 + 6 : 3` correcto es 9; a la bruta, `13 : 3`, que no es entero. El
    // orden importa de la manera más evidente posible.
    const piezas = [7, "+", 6, ":", 3];
    assert.equal(val(piezas), 9);
    assert.equal(valorDeIzquierdaADerecha(piezas), null);
    assert.equal(elOrdenImporta(piezas, 9), true);
  });

  test("una secuencia mal formada revienta en vez de devolver algo raro", () => {
    // Un árbol mal construido es un bug y tiene que verse; lo que no lanza es
    // la aritmética imposible, que es el camino normal de descarte.
    assert.throws(() => arbolDeSecuencia([2, "+"]), /secuencia inválida/);
    assert.throws(() => arbolDeSecuencia([2, "^", 3]), /secuencia inválida/);
    assert.throws(() => arbolDeSecuencia([2.5, "+", 1]), /secuencia inválida/);
    assert.equal(valorDeIzquierdaADerecha([2, "+"]), null, "esta no lanza, devuelve null");
  });

  test("el árbol se imprime como la secuencia, sin paréntesis de más", () => {
    // Si el renderizador metiera paréntesis donde la jerarquía ya los hace
    // innecesarios, el ejercicio dejaría de ser una combinada: se le estaría
    // dando resuelto el orden.
    assert.equal(render(arbolDeSecuencia([4, "+", 5, "-", 6, "·", 2])), "4 + 5 - 6 · 2");
    assert.equal(render(arbolDeSecuencia([2, "·", 3, "+", 4])), "2 · 3 + 4");
  });
}
