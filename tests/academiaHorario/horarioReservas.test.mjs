// Horas reservadas para un curso: "los lunes a las 17:30 solo viene
// Primaria".
//
// Lo que se prueba de verdad aquí es que una reserva está atada a una HORA
// y no a una fila de la rejilla. Con reservas por posición, cambiar la hora
// de apertura del centro las desplazaría todas y el papel que se le da a
// una familia diría que Primaria viene a una hora a la que ya no viene.
export async function run({ test, assert }) {
  const { claveReserva, normalizarReservas, reservasVigentes, nivelesDe, alternarNivel, hayReservas, esHoraAbierta } =
    await import("../../assets/shared/js/horarioReservas.js");
  const { bloquesDeConfig } = await import("../../assets/shared/js/horarioBloques.js");

  const LYCEO = { franja_inicio: "15:30", franja_fin: "20:30", franja_duracion: 60 };
  const bloques = bloquesDeConfig(LYCEO);
  const DIAS = [1, 2, 3, 4, 5];

  test("la clave es día + hora de inicio, no el número de fila", () => {
    assert.equal(claveReserva(1, "17:30"), "1|17:30");
    assert.equal(claveReserva("1", "17:30:00"), "1|17:30", "una hora de Postgres viene con segundos");
  });

  test("REGRESIÓN: adelantar la apertura del centro NO desplaza las reservas", () => {
    // El centro abría a las 15:30 y pasa a abrir a las 14:30. La reserva de
    // Primaria sigue a las 17:30 — no se sube a la fila de antes.
    const reservas = { "1|17:30": ["primaria"] };
    const nuevos = bloquesDeConfig({ ...LYCEO, franja_inicio: "14:30" });
    const bloque1730 = nuevos.find((b) => b.inicio === "17:30");
    assert.deepEqual(nivelesDe(reservas, 1, bloque1730), ["primaria"]);
    assert.deepEqual(nivelesDe(reservas, 1, nuevos[0]), [], "la primera fila, que ahora es otra hora, queda libre");
  });

  test("una reserva que se queda sin su hora desaparece al guardar", () => {
    // El centro cierra a las 19:30: la hora de las 19:30-20:30 ya no
    // existe, y con ella su reserva. Dejarla en la base de datos sería
    // arrastrarla para siempre sin forma de verla ni de borrarla.
    const reservas = { "1|18:30": ["eso"], "1|19:30": ["bachillerato"] };
    const vigentes = reservasVigentes(reservas, {
      dias: DIAS,
      bloques: bloquesDeConfig({ ...LYCEO, franja_fin: "19:30" }),
    });
    assert.deepEqual(vigentes, { "1|18:30": ["eso"] });
  });

  test("quitar el sábado de los días laborables se lleva sus reservas", () => {
    const reservas = { "1|17:30": ["eso"], "6|17:30": ["primaria"] };
    assert.deepEqual(reservasVigentes(reservas, { dias: DIAS, bloques }), { "1|17:30": ["eso"] });
  });

  // ── Saneado ──────────────────────────────────────────────────────────

  test("una clave que no es día+hora no cuela", () => {
    assert.deepEqual(normalizarReservas({ "lunes tarde": ["primaria"], "9|17:30": ["eso"], "1|25:00": ["eso"] }), {});
  });

  test("un valor que no es un nivel del sistema no cuela", () => {
    assert.deepEqual(normalizarReservas({ "1|17:30": ["fp"], "2|17:30": ["primaria", "fp"] }), { "2|17:30": ["primaria"] });
  });

  test("un nivel suelto (la forma vieja del objeto) se sigue leyendo como lista de uno", () => {
    // Antes de admitir varios cursos por hora el valor era una cadena. Un
    // jsonb guardado entonces tiene que seguir imprimiéndose igual.
    assert.deepEqual(normalizarReservas({ "1|17:30": "primaria" }), { "1|17:30": ["primaria"] });
  });

  test("los cursos salen siempre en orden escolar, se marquen como se marquen", () => {
    // Sin orden fijo, la casilla pondría "ESO · Prim." o "Prim. · ESO"
    // según el orden en que se pincharon, y dos horas iguales se leerían
    // distinto en el mismo papel.
    assert.deepEqual(normalizarReservas({ "1|17:30": ["bachillerato", "primaria"] })["1|17:30"], ["primaria", "bachillerato"]);
  });

  test("null o basura dan un objeto vacío, no revientan", () => {
    assert.deepEqual(normalizarReservas(null), {});
    assert.deepEqual(normalizarReservas("no soy un objeto"), {});
  });

  // ── Poner y quitar ───────────────────────────────────────────────────

  test("pinchar un curso lo marca; volver a pincharlo lo quita y BORRA la hora", () => {
    // Dejar una lista vacía en vez de borrar dejaría hayReservas() diciendo
    // que sí, y la hoja se imprimiría como rejilla con las veinticinco
    // casillas diciendo "Todos".
    let reservas = alternarNivel({}, 1, bloques[2], "eso");
    assert.deepEqual(reservas, { "1|17:30": ["eso"] });
    assert.equal(hayReservas(reservas), true);

    reservas = alternarNivel(reservas, 1, bloques[2], "eso");
    assert.deepEqual(reservas, {});
    assert.equal(hayReservas(reservas), false);
  });

  test("VARIOS PROFESORES: una misma hora admite dos cursos a la vez", () => {
    // A las 17:30 una profesora lleva Primaria y otro lleva ESO. Con un solo
    // curso por hora habría que elegir cuál de las dos mentir.
    let reservas = alternarNivel({}, 1, bloques[2], "eso");
    reservas = alternarNivel(reservas, 1, bloques[2], "primaria");
    assert.deepEqual(reservas["1|17:30"], ["primaria", "eso"], "en orden escolar, no en el de pinchado");
  });

  test("quitar uno de los dos cursos deja el otro, no borra la hora", () => {
    let reservas = { "1|17:30": ["primaria", "eso"] };
    reservas = alternarNivel(reservas, 1, bloques[2], "primaria");
    assert.deepEqual(reservas, { "1|17:30": ["eso"] });
  });

  test("un nivel inventado no cambia nada", () => {
    assert.deepEqual(alternarNivel({ "1|17:30": ["eso"] }, 1, bloques[2], "fp"), { "1|17:30": ["eso"] });
  });

  test("alternarNivel no muta el objeto que recibe", () => {
    const original = { "1|17:30": ["eso"] };
    alternarNivel(original, 2, bloques[2], "primaria");
    assert.deepEqual(original, { "1|17:30": ["eso"] });
  });

  test("marcar TODOS los cursos es lo mismo que no marcar ninguno: hora abierta", () => {
    // Si no, completar la rejilla por gusto imprimiría "Prim. · ESO · Bach."
    // en una casilla donde cabe "Todos".
    assert.equal(esHoraAbierta([]), true);
    assert.equal(esHoraAbierta(["primaria", "eso", "bachillerato"]), true);
    assert.equal(esHoraAbierta(["primaria"]), false);
    assert.equal(esHoraAbierta(["primaria", "eso"]), false);
  });

  test("sin ninguna reserva, hayReservas es false — que es lo que decide la forma de la hoja", () => {
    assert.equal(hayReservas({}), false);
    assert.equal(hayReservas(null), false);
  });
}
