import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// LA HOJA DEL CUADRANTE: días, horas y nombres.
//
// Jorge, 16/09/2026: *"al imprimir el horario en vertical sale bien, pero en
// horizontal se corta y si le bajo la escala no aparece lo cortado, tampoco
// aparece en dos hojas... es como si desapareciera. Podríamos simplificar lo
// que se imprime, tipo la foto, solo días, horas y nombres"*.
//
// LA CAUSA no era el CSS de impresión: las dos rejillas de pantalla son cajas
// con scroll, y una caja con scroll se imprime cortada por donde corta en
// pantalla y no pasa a un segundo folio. Por eso bajar la escala no servía.
//
// Así que el papel tiene su propio dibujo — una `<table>` de verdad, que el
// navegador parte entre folios y cuyo ancho se reparte entre las columnas.
// LOS DATOS SIGUEN SIENDO LOS MISMOS: salen de `repartirEnBloques`, la misma
// función que pinta las dos rejillas y que calcula la hoja de las familias.
//
// Lo que se prueba aquí es lo que el papel NO puede perder: la hora de quien
// no ocupa la fila entera, el aviso de quien todavía no viene, y cuál de los
// dos Danieles es cada uno.
export async function run({ test, assert }) {
  const {
    buildTablaImprimible, nombresDeCelda, normalizarDias, textoDeCelda, textoDePlazas,
  } = await import("../../assets/shared/js/cuadranteImprimible.js");

  const doc = globalThis.document;
  const HOY = "2026-09-16";
  const alumno = (nombre, extra = {}) => ({ alumno: { nombre }, ...extra });

  // ── Los nombres ──────────────────────────────────────────────────────

  test("en el papel va el nombre de pila, como en el cuaderno", () => {
    assert.deepEqual(
      nombresDeCelda([alumno("Rakel Trallero Gallego"), alumno("Lucía López Ubán")]),
      ["Rakel", "Lucía"]
    );
  });

  // En pantalla dos "Daniel" se distinguen pasando el ratón por encima. En un
  // folio no hay ratón, y la misma hora con dos Danieles es justo el sitio
  // donde hace falta saber cuál es cuál.
  test("dos nombres de pila iguales en la misma hora se distinguen con la inicial", () => {
    assert.deepEqual(
      nombresDeCelda([alumno("Daniel Abadias Otal"), alumno("Daniel Esteban Giménez")]),
      ["Daniel A.", "Daniel E."]
    );
  });

  test("el mismo alumno repetido no se convierte en dos Danieles distintos", () => {
    assert.deepEqual(
      nombresDeCelda([alumno("Daniel Abadias Otal"), alumno("Daniel Abadias Otal")]),
      ["Daniel", "Daniel"]
    );
  });

  test("un alumno sin apellido no inventa una inicial", () => {
    assert.deepEqual(nombresDeCelda([alumno("Daniel"), alumno("Daniel Otal")]), ["Daniel", "Daniel O."]);
  });

  test("una franja sin alumno no rompe la fila", () => {
    assert.deepEqual(nombresDeCelda([{}]), ["(sin nombre)"]);
  });

  // ── El contenido de una casilla ──────────────────────────────────────

  test("los nombres se separan con ' / ', como en la hoja de cálculo de Jorge", () => {
    const celda = { dentro: [alumno("Daniel Otal"), alumno("Lucía López"), alumno("Alex Solsona")] };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY }), "Daniel / Lucía / Alex");
  });

  // Sin la hora, alguien que viene de 16:00 a 17:00 parece que viene de 15:30
  // a 16:30. Es el fallo que Jorge encontró el 11/09 con Rakel, aquí en papel.
  test("quien no ocupa la fila entera lleva SU hora detrás", () => {
    const celda = {
      dentro: [alumno("Eric Val")],
      sueltas: [alumno("Rakel Trallero", { hora_inicio: "16:00", hora_fin: "17:00" })],
    };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY }), "Eric / Rakel (16:00 – 17:00)");
  });

  // Decisión de Jorge del 11/09 ("sí, que se vea"): la plaza está comprometida
  // —por eso sale— pero quien esté hoy en el aula es otra cosa.
  test("quien todavía no ha empezado sale marcado con su fecha", () => {
    const celda = { dentro: [alumno("Cristian Marquez", { fecha_inicio: "2026-10-01" })] };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY }), "Cristian (desde 1/10)");
  });

  // ESTO ES LO QUE PIDIÓ JORGE EL 16/09: *"cuando pase la fecha de comienzo,
  // tendría que desaparecer el aviso"*. La regla vive en desdeFecha.js y ya
  // era así; aquí se fija para el papel, que es una vía nueva.
  test("cuando la fecha de comienzo ya ha pasado, el aviso desaparece", () => {
    const celda = { dentro: [alumno("Cristian Marquez", { fecha_inicio: "2026-10-01" })] };
    assert.equal(textoDeCelda(celda, { hoyISO: "2026-10-01" }), "Cristian", "el mismo día ya cuenta");
    assert.equal(textoDeCelda(celda, { hoyISO: "2026-10-02" }), "Cristian");
  });

  test("hora y 'desde' juntos, separados por coma", () => {
    const celda = {
      sueltas: [alumno("Enara Romero", { hora_inicio: "17:00", hora_fin: "19:00", fecha_inicio: "2026-09-21" })],
    };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY }), "Enara (17:00 – 19:00, desde 21/9)");
  });

  test("una hora sin nadie se queda en blanco, no con un guion", () => {
    // Un guion repetido en veinte casillas es ruido; el hueco vacío ya dice
    // que no hay clase.
    assert.equal(textoDeCelda({}, { hoyISO: HOY }), "");
  });

  // ── El curso y el contador: opcionales y apagados ────────────────────

  // Jorge, 16/09: *"si crees que cabe sin simplificar, mejor"*. Cabe, pero no
  // sale gratis: la letra la elige ajusteDelCuadrante.js midiendo lo que ocupa
  // el contenido, así que encender el curso baja el cuerpo de 16pt a 12pt en el
  // cuadrante real. Medido en Chromium, no supuesto. Por eso vienen apagados.
  test("por defecto no sale el curso ni el contador", () => {
    const celda = { dentro: [{ alumno: { nombre: "Daniel Otal", curso: "3º ESO" } }], ocupacion: 1 };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY, maxPorFranja: 6 }), "Daniel");
  });

  test("con conCurso, el curso va detrás del nombre", () => {
    const celda = { dentro: [{ alumno: { nombre: "Daniel Otal", curso: "3º ESO" } }] };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY, conCurso: true }), "Daniel (3º ESO)");
  });

  test("un alumno sin curso no deja un paréntesis vacío", () => {
    const celda = { dentro: [{ alumno: { nombre: "Daniel Otal" } }] };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY, conCurso: true }), "Daniel");
  });

  test("curso, hora y 'desde' conviven en el mismo paréntesis", () => {
    const celda = {
      sueltas: [{
        alumno: { nombre: "Rakel Trallero", curso: "2º ESO" },
        hora_inicio: "16:00", hora_fin: "17:00", fecha_inicio: "2026-10-01",
      }],
    };
    assert.equal(
      textoDeCelda(celda, { hoyISO: HOY, conCurso: true }),
      "Rakel (2º ESO, 16:00 – 17:00, desde 1/10)"
    );
  });

  test("con conContador, el contador va delante — es la pregunta al mirar un hueco", () => {
    const celda = { dentro: [{ alumno: { nombre: "Daniel Otal" } }], ocupacion: 4 };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY, conContador: true, maxPorFranja: 6 }), "4/6 · Daniel");
  });

  test("una casilla vacía no imprime un contador suelto", () => {
    assert.equal(textoDeCelda({ ocupacion: 0 }, { hoyISO: HOY, conContador: true, maxPorFranja: 6 }), "");
  });

  // ── El modo "enseñar a una familia" ──────────────────────────────────

  test("sin nombres, la casilla dice las plazas que quedan", () => {
    assert.equal(textoDePlazas({ ocupacion: 2 }, 6), "4 plazas");
    assert.equal(textoDePlazas({ ocupacion: 5 }, 6), "1 plaza");
    assert.equal(textoDePlazas({ ocupacion: 6 }, 6), "Completo");
  });

  test("una ocupación mayor que el tope no da plazas negativas", () => {
    assert.equal(textoDePlazas({ ocupacion: 8 }, 6), "Completo");
  });

  test("sin tope de plazas configurado no se inventa un número", () => {
    assert.equal(textoDePlazas({ ocupacion: 3 }, 0), "");
  });

  // ── La tabla ─────────────────────────────────────────────────────────

  const DIAS = [{ value: 1, name: "Lunes" }, { value: 2, name: "Martes" }];
  const BLOQUES = [{ inicio: "15:30", fin: "16:30" }, { inicio: "16:30", fin: "17:30" }];
  const FRANJAS = [
    { dia_semana: 1, hora_inicio: "15:30", hora_fin: "16:30", alumno: { nombre: "Daniel Otal" } },
    { dia_semana: 1, hora_inicio: "15:30", hora_fin: "16:30", alumno: { nombre: "Lucía López" } },
    { dia_semana: 2, hora_inicio: "16:30", hora_fin: "17:30", alumno: { nombre: "Eric Val" } },
  ];

  test("una fila por hora y una columna por día, con su cabecera", () => {
    const hoja = buildTablaImprimible({ franjas: FRANJAS, dias: DIAS, bloques: BLOQUES, doc, hoyISO: HOY });
    const cabeceras = [...hoja.querySelectorAll("thead th")].map((th) => th.textContent);
    assert.deepEqual(cabeceras, ["Hora", "Lunes", "Martes"]);
    assert.equal(hoja.querySelectorAll("tbody tr").length, BLOQUES.length);
  });

  test("cada alumno cae en su día y en su hora", () => {
    const hoja = buildTablaImprimible({ franjas: FRANJAS, dias: DIAS, bloques: BLOQUES, doc, hoyISO: HOY });
    const filas = [...hoja.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.children].map((c) => c.textContent)
    );
    assert.deepEqual(filas[0], ["15:30–16:30", "Daniel / Lucía", ""]);
    assert.deepEqual(filas[1], ["16:30–17:30", "", "Eric"]);
  });

  test("la tabla no se ve en pantalla: existe solo para el papel", () => {
    const hoja = buildTablaImprimible({ franjas: [], dias: DIAS, bloques: BLOQUES, doc });
    assert.ok(hoja.classList.contains("ac-print-solo"));
  });

  test("sin franjas configuradas se dice, en vez de imprimir una tabla vacía", () => {
    const hoja = buildTablaImprimible({ franjas: FRANJAS, dias: DIAS, bloques: [], doc });
    assert.equal(hoja.querySelector("table"), null);
    assert.match(hoja.textContent, /No hay franjas configuradas/);
  });

  test("el título del grupo sale en la hoja: con 'Todos' hay una por profesor", () => {
    const hoja = buildTablaImprimible({
      franjas: FRANJAS, dias: DIAS, bloques: BLOQUES, titulo: "Jorge Moreno", doc,
    });
    assert.equal(hoja.querySelector(".cq-titulo")?.textContent, "Jorge Moreno");
  });

  // Los dos paneles llaman con formas distintas y ninguno debería cambiar la
  // suya por esto.
  test("acepta los días como números (panel del centro) y como objetos (aula)", () => {
    assert.deepEqual(normalizarDias([1, 5]), [
      { value: 1, name: "Lunes" }, { value: 5, name: "Viernes" },
    ]);
    assert.deepEqual(normalizarDias([{ value: 3, name: "Miércoles" }]), [
      { value: 3, name: "Miércoles" },
    ]);
  });

  test("en modo sin nombres, en el papel no queda ni un nombre", () => {
    const hoja = buildTablaImprimible({
      franjas: FRANJAS, dias: DIAS, bloques: BLOQUES, maxPorFranja: 6, sinNombres: true, doc,
    });
    assert.equal(/Daniel|Lucía|Eric/.test(hoja.textContent), false, hoja.textContent);
    assert.match(hoja.textContent, /plazas/);
  });
}
