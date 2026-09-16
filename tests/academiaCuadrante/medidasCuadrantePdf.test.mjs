import assert from "node:assert/strict";

// LAS MEDIDAS DEL CUADRANTE EN PAPEL.
//
// Es lo único del PDF que puede equivocarse de verdad —lo demás son
// rectángulos— y por eso está en su propio archivo, con la función que mide el
// texto como parámetro: se prueba entero sin generar un solo PDF.
//
// Y ES DONDE ESTABA EL PROBLEMA DE LOS TRES INTENTOS ANTERIORES: medir desde
// el navegador es medir a ciegas, porque el folio no es suyo (Safari ignora
// `@page`, los márgenes los pone la impresora y la escala del diálogo cambia
// la geometría después). Aquí el folio está escrito en puntos y el texto se
// mide con las métricas reales de la tipografía que se va a imprimir.
export async function run({ test }) {
  const {
    CUERPOS_PT, ALTO_MINIMO_FILA, PADDING_CELDA,
    altoDeFila, altoDeCabecera, altoDeTabla, anchoDeColumnas, elegirCuerpo, repartirEnPaginas,
  } = await import("../../server/lib/academiaCuadrante/medidasCuadrantePdf.js");

  const COLUMNAS = [1, 2, 3, 4, 5].map((v) => ({ value: v, name: `D${v}` }));
  // Un medidor de mentira pero honesto: el alto crece con el cuerpo de letra y
  // con lo que haya que escribir, y baja si hay más ancho. Es la forma que
  // tiene el texto de verdad.
  const medirFalso = (texto, ancho, cuerpo) =>
    texto ? Math.ceil(String(texto).length / Math.max(1, ancho / cuerpo)) * cuerpo * 1.2 : 0;

  const fila = (celdas) => ({ hora: "15:30–16:30", celdas });
  const FILAS = [
    fila(["Alex / Daniel", "Antonio / Daniel / Lucía / Marta", "Alex", "Antonio", "Daniel"]),
    fila(["Aarón / Eric", "Aarón / Eric / Luis / Óscar", "Enara / Eric", "Aarón", "Julián"]),
  ];

  // ── El reparto del ancho ─────────────────────────────────────────────

  // La columna de la hora mide lo que mide "15:30–16:30" y ni un punto más:
  // todo lo que sobre se lo quedan los nombres, que es lo que hay que leer.
  test("la hora se lleva lo justo y el resto se reparte entre los días", () => {
    const anchos = anchoDeColumnas({ anchoTotal: 700, columnas: COLUMNAS, anchoHora: 60 });
    assert.equal(anchos.hora, 60);
    assert.equal(anchos.dia, (700 - 60) / 5);
  });

  test("sin columnas no se divide por cero", () => {
    assert.equal(anchoDeColumnas({ anchoTotal: 700, columnas: [], anchoHora: 60 }).dia, 0);
  });

  // ── Los altos ────────────────────────────────────────────────────────

  test("la fila mide lo que su casilla más alta, con su aire", () => {
    const anchos = { hora: 60, dia: 130 };
    const alto = altoDeFila(FILAS[0], { anchos, cuerpo: 10, medirTexto: medirFalso });
    const masAlta = Math.max(...FILAS[0].celdas.map((c) => medirFalso(c, 130 - PADDING_CELDA * 2, 10)));
    assert.equal(alto, Math.max(ALTO_MINIMO_FILA, masAlta + PADDING_CELDA * 2));
  });

  // Una hora sin clases sigue siendo una fila: sin mínimo, la del viernes a
  // las 19:30 se quedaría en una raya de dos puntos.
  test("una fila vacía no desaparece: tiene alto mínimo", () => {
    const alto = altoDeFila({ hora: "", celdas: ["", "", ""] }, { anchos: { hora: 60, dia: 130 }, cuerpo: 10, medirTexto: medirFalso });
    assert.equal(alto, ALTO_MINIMO_FILA);
  });

  test("la tabla mide la cabecera más todas sus filas", () => {
    const anchos = { hora: 60, dia: 130 };
    const total = altoDeTabla({ columnas: COLUMNAS, filas: FILAS, anchos, cuerpo: 10, medirTexto: medirFalso });
    const suma = altoDeCabecera({ columnas: COLUMNAS, anchos, cuerpo: 10, medirTexto: medirFalso })
      + FILAS.reduce((t, f) => t + altoDeFila(f, { anchos, cuerpo: 10, medirTexto: medirFalso }), 0);
    assert.equal(total, suma);
  });

  // ── El cuerpo de letra ───────────────────────────────────────────────

  const elegir = (altoDisponible) => elegirCuerpo({
    columnas: COLUMNAS, filas: FILAS, anchoTotal: 700,
    anchoHoraPorCuerpo: (cuerpo) => cuerpo * 5,
    altoDisponible, medirTexto: medirFalso,
  });

  // Se agranda la letra, no se estiran las filas: estirarlas deja casillas
  // enormes con el texto minúsculo pegado arriba.
  test("se queda con el cuerpo más grande que cabe entero", () => {
    const grande = elegir(500);
    const apretado = elegir(80);
    assert.ok(CUERPOS_PT.includes(grande.cuerpo));
    assert.ok(grande.cuerpo > apretado.cuerpo, `${grande.cuerpo} debería ser mayor que ${apretado.cuerpo}`);
  });

  test("el elegido cabe de verdad, y el siguiente más grande no", () => {
    const { cuerpo, anchos } = elegir(200);
    assert.ok(altoDeTabla({ columnas: COLUMNAS, filas: FILAS, anchos, cuerpo, medirTexto: medirFalso }) <= 200);
    const mayor = CUERPOS_PT[CUERPOS_PT.indexOf(cuerpo) - 1];
    if (mayor) {
      const anchosMayor = anchoDeColumnas({ anchoTotal: 700, columnas: COLUMNAS, anchoHora: mayor * 5 });
      assert.ok(
        altoDeTabla({ columnas: COLUMNAS, filas: FILAS, anchos: anchosMayor, cuerpo: mayor, medirTexto: medirFalso }) > 200,
        `${mayor}pt también cabía: se está eligiendo por debajo de lo posible`
      );
    }
  });

  test("con un folio ridículo se usa el cuerpo mínimo, no uno inventado", () => {
    assert.equal(elegir(1).cuerpo, Math.min(...CUERPOS_PT));
  });

  test("el ancho de la hora cambia con el cuerpo: si no, a 16pt se parte en dos líneas", () => {
    assert.ok(elegir(500).anchos.hora > elegir(80).anchos.hora);
  });

  // ── El reparto en páginas ────────────────────────────────────────────

  const repartir = (altoDisponible, filas = FILAS) => repartirEnPaginas({
    columnas: COLUMNAS, filas, anchos: { hora: 60, dia: 130 }, cuerpo: 10,
    altoDisponible, medirTexto: medirFalso,
  });

  test("si cabe todo, una sola página", () => {
    assert.equal(repartir(1000).paginas.length, 1);
  });

  // Lo que el navegador NO podía hacer: una caja con scroll no se parte, así
  // que lo que sobraba desaparecía. Aquí continúa en la página siguiente.
  test("si no cabe, continúa en la siguiente en vez de perder filas", () => {
    const muchas = Array.from({ length: 30 }, () => FILAS[0]);
    const { paginas } = repartir(200, muchas);
    assert.ok(paginas.length > 1, "debería haber pasado de página");
    assert.equal(paginas.flat().length, muchas.length, "no se puede perder ni una fila");
  });

  test("una fila no se parte nunca entre dos páginas", () => {
    const muchas = Array.from({ length: 12 }, () => FILAS[0]);
    const { paginas, altoCabecera } = repartir(160, muchas);
    for (const pagina of paginas) {
      const alto = altoCabecera + pagina.reduce((t, f) => t + f.alto, 0);
      assert.ok(alto <= 160 || pagina.length === 1, `una página se pasa: ${alto}`);
    }
  });

  test("una fila más alta que la página entera se queda sola, sin bucle infinito", () => {
    const { paginas } = repartir(10, [FILAS[0], FILAS[1]]);
    assert.equal(paginas.length, 2);
    assert.equal(paginas.flat().length, 2);
  });
}
