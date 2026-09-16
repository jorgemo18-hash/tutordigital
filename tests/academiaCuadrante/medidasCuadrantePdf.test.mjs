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
    CUERPOS_PT, ALTO_MINIMO_FILA, PADDING_CELDA, SEPARADOR_EM, HUECO_CURSO_EM,
    altoDeCelda, altoDeFila, altoDeCabecera, altoDeTabla, anchoDeColumnas, elegirCuerpo, repartirEnPaginas,
  } = await import("../../server/lib/academiaCuadrante/medidasCuadrantePdf.js");

  const COLUMNAS = [1, 2, 3, 4, 5].map((v) => ({ value: v, name: `D${v}` }));
  // Medidores de mentira pero honestos: el alto crece con el cuerpo de letra y
  // con lo que haya que escribir, y baja si hay más ancho; el ancho crece con
  // el largo del texto. Es la forma que tiene el texto de verdad.
  const medirFalso = (texto, ancho, cuerpo) =>
    texto ? Math.ceil(String(texto).length / Math.max(1, ancho / cuerpo)) * cuerpo * 1.2 : 0;
  const medirAnchoFalso = (texto, cuerpo) => String(texto || "").length * cuerpo * 0.5;

  // Casillas de verdad, con la forma que devuelve filasDelCuadrante: un alumno
  // por línea, y las notas (hora y fecha de comienzo) debajo. Con casillas de
  // texto suelto estos tests pasarían sin medir nada.
  const alumno = (nombre, extra = {}) => ({ nombre, curso: "3º ESO", hora: "", desde: "", ...extra });
  const celda = (dentro = [], sueltas = []) => ({ texto: "", dentro, sueltas });
  const fila = (celdas) => ({ hora: "15:30–16:30", celdas });
  const FILAS = [
    fila([
      celda([alumno("Alex"), alumno("Daniel")]),
      celda([alumno("Antonio"), alumno("Daniel"), alumno("Lucía"), alumno("Marta")],
        [alumno("Rakel", { hora: "16:00 – 16:30" })]),
      celda([alumno("Alex")]),
      celda([alumno("Antonio")]),
      celda([alumno("Daniel")]),
    ]),
    fila([
      celda([alumno("Aarón"), alumno("Eric")]),
      celda([alumno("Aarón"), alumno("Eric"), alumno("Luis"), alumno("Óscar", { desde: "desde 22/9" })]),
      celda([alumno("Enara"), alumno("Eric")]),
      celda([alumno("Aarón")]),
      celda([alumno("Julián")]),
    ]),
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
    const alto = altoDeFila(FILAS[0], { anchos, cuerpo: 10, medirTexto: medirFalso, medirAncho: medirAnchoFalso });
    const masAlta = Math.max(...FILAS[0].celdas.map((c) =>
      altoDeCelda(c, { ancho: anchos.dia, cuerpo: 10, medirTexto: medirFalso, medirAncho: medirAnchoFalso })
    ));
    assert.equal(alto, Math.max(ALTO_MINIMO_FILA, masAlta + PADDING_CELDA * 2));
  });

  // Una hora sin clases sigue siendo una fila: sin mínimo, la del viernes a
  // las 19:30 se quedaría en una raya de dos puntos.
  test("una fila vacía no desaparece: tiene alto mínimo", () => {
    const vacia = { hora: "", celdas: [celda(), celda(), celda()] };
    const alto = altoDeFila(vacia, { anchos: { hora: 60, dia: 130 }, cuerpo: 10, medirTexto: medirFalso, medirAncho: medirAnchoFalso });
    assert.equal(alto, ALTO_MINIMO_FILA);
  });

  // ── Lo que hace alta una casilla ─────────────────────────────────────

  const medirCelda = (c, ancho = 130) =>
    altoDeCelda(c, { ancho, cuerpo: 10, medirTexto: medirFalso, medirAncho: medirAnchoFalso });

  test("cada alumno suma una línea", () => {
    const uno = medirCelda(celda([alumno("Alex")]));
    const dos = medirCelda(celda([alumno("Alex"), alumno("Daniel")]));
    assert.ok(dos > uno, "dos alumnos tienen que ocupar más que uno");
  });

  // La hora y el "desde" van en su propia línea sangrada, así que cuentan.
  test("las notas de un alumno también ocupan su línea", () => {
    const limpio = medirCelda(celda([alumno("Alex")]));
    const conNota = medirCelda(celda([alumno("Alex", { desde: "desde 1/10" })]));
    assert.ok(conNota > limpio, "el 'desde' va debajo y ocupa");
  });

  test("la raya de puntos de los de media hora reserva su hueco", () => {
    const sinRaya = medirCelda(celda([alumno("Alex"), alumno("Rakel")]));
    const conRaya = medirCelda(celda([alumno("Alex")], [alumno("Rakel")]));
    assert.ok(conRaya > sinRaya, "la raya tiene que reservar sitio o cae encima del nombre");
    assert.ok(Math.abs((conRaya - sinRaya) - 10 * SEPARADOR_EM) < 0.01);
  });

  // EL DEFECTO QUE ESTO EVITA: si el nombre se midiera contra la casilla
  // entera, un nombre largo cabría en el cálculo y en el papel se montaría
  // encima del curso de la derecha.
  test("REGRESIÓN: el nombre se mide contra el ancho que deja el curso", () => {
    const conCurso = medirCelda(celda([alumno("Alejandra Ferrer", { curso: "4º PRIM" })]));
    const sinCurso = medirCelda(celda([alumno("Alejandra Ferrer", { curso: "" })]));
    assert.ok(conCurso >= sinCurso, "apartar el curso solo puede hacer el nombre más alto, nunca más bajo");
    assert.ok(HUECO_CURSO_EM > 0, "y tiene que quedar aire entre el nombre y el curso");
  });

  test("la tabla mide la cabecera más todas sus filas", () => {
    const anchos = { hora: 60, dia: 130 };
    const total = altoDeTabla({ columnas: COLUMNAS, filas: FILAS, anchos, cuerpo: 10, medirTexto: medirFalso, medirAncho: medirAnchoFalso });
    const suma = altoDeCabecera({ columnas: COLUMNAS, anchos, cuerpo: 10, medirTexto: medirFalso })
      + FILAS.reduce((t, f) => t + altoDeFila(f, { anchos, cuerpo: 10, medirTexto: medirFalso, medirAncho: medirAnchoFalso }), 0);
    assert.equal(total, suma);
  });

  // ── El cuerpo de letra ───────────────────────────────────────────────

  const elegir = (altoDisponible) => elegirCuerpo({
    columnas: COLUMNAS, filas: FILAS, anchoTotal: 700,
    anchoHoraPorCuerpo: (cuerpo) => cuerpo * 5,
    altoDisponible, medirTexto: medirFalso, medirAncho: medirAnchoFalso,
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
    assert.ok(altoDeTabla({ columnas: COLUMNAS, filas: FILAS, anchos, cuerpo, medirTexto: medirFalso, medirAncho: medirAnchoFalso }) <= 200);
    const mayor = CUERPOS_PT[CUERPOS_PT.indexOf(cuerpo) - 1];
    if (mayor) {
      const anchosMayor = anchoDeColumnas({ anchoTotal: 700, columnas: COLUMNAS, anchoHora: mayor * 5 });
      assert.ok(
        altoDeTabla({ columnas: COLUMNAS, filas: FILAS, anchos: anchosMayor, cuerpo: mayor, medirTexto: medirFalso, medirAncho: medirAnchoFalso }) > 200,
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
    altoDisponible, medirTexto: medirFalso, medirAncho: medirAnchoFalso,
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
