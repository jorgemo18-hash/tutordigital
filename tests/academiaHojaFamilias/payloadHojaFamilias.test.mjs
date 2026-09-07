// Lo que se imprime en la hoja para familias, sacado de la configuración
// del centro.
//
// La prueba de fondo es que el horario NO se escribe a mano: sale del mismo
// sitio que el cuadrante de "Dar clase". Un papel impreso con un horario
// que ya no es el del centro es peor que no tener papel.
export async function run({ test, assert }) {
  const { construirPayloadHojaFamilias, etiquetaDias, lineasContacto } =
    await import("../../server/lib/academiaHojaFamilias/payloadHojaFamilias.js");

  // La configuración real de Lyceo (producción, 03/09).
  const LYCEO = {
    franja_inicio: "15:30:00",
    franja_fin: "20:30:00",
    franja_duracion: 60,
    dias_laborables: [1, 2, 3, 4, 5],
    telefono_emisor: "675324128",
    email_emisor: "info@lyceoacademia.es",
    direccion_emisor: "Jazmín 1 bajos",
    nombre_emisor: "Lyceo academia",
  };

  test("el horario de la hoja es EL MISMO que el del cuadrante", () => {
    const { bloques } = construirPayloadHojaFamilias({ tenantNombre: "Lyceo", config: LYCEO });
    assert.deepEqual(bloques, [
      "15:30 – 16:30", "16:30 – 17:30", "17:30 – 18:30", "18:30 – 19:30", "19:30 – 20:30",
    ]);
  });

  test("si el centro cambia su hora de cierre, la hoja lo dice sin tocarla", () => {
    const { bloques } = construirPayloadHojaFamilias({ config: { ...LYCEO, franja_fin: "19:30" } });
    assert.deepEqual(bloques.slice(-1), ["18:30 – 19:30"]);
  });

  test("jornada partida: salen los dos tramos, sin las horas muertas del mediodía", () => {
    const { bloques } = construirPayloadHojaFamilias({
      config: { franja_inicio: "09:00", franja_fin: "11:00", franja_duracion: 60, franja_inicio_2: "16:00", franja_fin_2: "18:00" },
    });
    assert.deepEqual(bloques, ["09:00 – 10:00", "10:00 – 11:00", "16:00 – 17:00", "17:00 – 18:00"]);
  });

  // ── Los días ─────────────────────────────────────────────────────────

  test("días seguidos: 'Lunes a viernes'", () => {
    assert.equal(etiquetaDias([1, 2, 3, 4, 5]), "Lunes a viernes");
    assert.equal(etiquetaDias([1, 2, 3, 4, 5, 6]), "Lunes a sábado");
  });

  test("días sueltos: 'Martes, jueves y viernes' — nunca 'martes a viernes', que sería mentira", () => {
    assert.equal(etiquetaDias([2, 4, 5]), "Martes, jueves y viernes");
  });

  test("un solo día no se escribe como un rango", () => {
    assert.equal(etiquetaDias([3]), "Miércoles");
  });

  test("días desordenados o repetidos (un jsonb a mano) se ordenan solos", () => {
    assert.equal(etiquetaDias([5, 1, 3, 1]), "Lunes, miércoles y viernes");
  });

  test("sin días configurados se asume lunes a viernes, no una hoja sin horario", () => {
    assert.equal(etiquetaDias(undefined), "Lunes a viernes");
    assert.equal(etiquetaDias([]), "");
  });

  // ── El contacto ──────────────────────────────────────────────────────

  test("solo salen las líneas de contacto que existen", () => {
    // Un "Teléfono: —" en un papel que se entrega hace dudar de todo lo
    // demás que ponga.
    assert.deepEqual(lineasContacto({ telefono_emisor: "675324128", email_emisor: "", direccion_emisor: null }), ["675324128"]);
    assert.deepEqual(lineasContacto({}), []);
  });

  // ── Los precios ──────────────────────────────────────────────────────

  test("una tabla de precios con los ejes puestos pero SIN precios no se imprime", () => {
    const datos = construirPayloadHojaFamilias({
      config: {
        ...LYCEO,
        precios_publicos: { columnas: [{ id: "c1", titulo: "Primaria" }], filas: [{ id: "f1", titulo: "1 día" }], precios: {} },
      },
    });
    assert.equal(datos.precios, null, "un cuadro en blanco es peor que no llevar cuadro");
  });

  test("con precios puestos, la tabla va saneada y entera", () => {
    const datos = construirPayloadHojaFamilias({
      config: {
        ...LYCEO,
        precios_publicos: {
          columnas: [{ id: "c1", titulo: "Primaria" }],
          filas: [{ id: "f1", titulo: "1 día" }],
          precios: { "f1|c1": "40 €", "f9|c1": "huérfano" },
          nota: "Matrícula gratuita",
        },
      },
    });
    assert.deepEqual(datos.precios.precios, { "f1|c1": "40 €" });
    assert.equal(datos.precios.nota, "Matrícula gratuita");
  });

  test("un centro sin precios_publicos (nunca abrió la pestaña) da una hoja solo con el horario", () => {
    const datos = construirPayloadHojaFamilias({ tenantNombre: "Lyceo", config: LYCEO });
    assert.equal(datos.precios, null);
    assert.equal(datos.bloques.length, 5);
  });

  // ── La rejilla del horario ───────────────────────────────────────────

  const textos = (rejilla, fila) => rejilla.filas[fila].celdas.map((c) => c.texto);

  test("el horario va SIEMPRE como rejilla, aunque no haya nada que escribir", () => {
    // Es lo que se rodea a bolígrafo delante de una familia. Una lista de
    // horas no se puede rodear.
    const { rejilla } = construirPayloadHojaFamilias({ config: LYCEO });
    assert.deepEqual(rejilla.dias, ["Lun", "Mar", "Mié", "Jue", "Vie"]);
    assert.equal(rejilla.filas.length, 5, "una fila por clase del centro");
    assert.equal(rejilla.filas[2].hora, "17:30 – 18:30");
  });

  test("sin ninguna hora reservada las casillas van EN BLANCO, no repitiendo 'Todos'", () => {
    // Veinticinco veces la misma palabra solo estorba en una plantilla que
    // se rellena a mano.
    assert.deepEqual(textos(construirPayloadHojaFamilias({ config: LYCEO }).rejilla, 0), ["", "", "", "", ""]);
  });

  test("en cuanto hay una hora reservada, las demás SÍ dicen 'Todos'", () => {
    // Con unas casillas escritas y otras vacías, el hueco en blanco se
    // leería como "ese día a esa hora no hay clase".
    const { rejilla } = construirPayloadHojaFamilias({
      config: { ...LYCEO, horario_reservas: { "1|17:30": ["primaria"] } },
    });
    assert.deepEqual(textos(rejilla, 2), ["Primaria", "Todos", "Todos", "Todos", "Todos"]);
  });

  test("Bachillerato se imprime como 'Bach.': en una casilla de 38 pt no cabe entero", () => {
    const { rejilla } = construirPayloadHojaFamilias({
      config: { ...LYCEO, horario_reservas: { "2|18:30": ["bachillerato"] } },
    });
    assert.equal(rejilla.filas[3].celdas[1].texto, "Bach.");
  });

  test("VARIOS PROFESORES: una hora con dos cursos los imprime los dos", () => {
    const { rejilla } = construirPayloadHojaFamilias({
      config: { ...LYCEO, horario_reservas: { "1|17:30": ["primaria", "eso"] } },
    });
    assert.equal(rejilla.filas[2].celdas[0].texto, "Primaria · ESO");
  });

  test("una hora con TODOS los cursos marcados se imprime 'Todos', no la lista entera", () => {
    const { rejilla } = construirPayloadHojaFamilias({
      config: {
        ...LYCEO,
        horario_reservas: { "1|15:30": ["eso"], "1|17:30": ["primaria", "eso", "bachillerato"] },
      },
    });
    assert.equal(rejilla.filas[2].celdas[0].texto, "Todos");
  });

  test("la rejilla solo lleva los días laborables del centro", () => {
    const { rejilla } = construirPayloadHojaFamilias({ config: { ...LYCEO, dias_laborables: [2, 4] } });
    assert.deepEqual(rejilla.dias, ["Mar", "Jue"]);
    assert.equal(rejilla.filas[0].celdas.length, 2);
  });

  // ── Las horas completas ──────────────────────────────────────────────

  const llenas = (rejilla) =>
    rejilla.filas.flatMap((f, i) => f.celdas.map((c, j) => (c.completo ? `${i}:${j}` : null))).filter(Boolean);

  test("una hora que llega al tope de plazas sale marcada; las demás no", () => {
    const franjas = Array.from({ length: 6 }, () => ({ dia_semana: 2, hora_inicio: "16:30", hora_fin: "17:30" }));
    const { rejilla } = construirPayloadHojaFamilias({
      config: { ...LYCEO, max_alumnos_por_franja: 6 },
      franjas,
    });
    assert.deepEqual(llenas(rejilla), ["1:1"], "solo el martes a las 16:30");
    assert.equal(rejilla.hayCompletas, true, "y con eso se imprime la leyenda");
  });

  test("SIN límite de plazas configurado no se marca NADA", () => {
    // Sin tope no existe la idea de "llena": marcarlo sería inventárselo.
    const franjas = Array.from({ length: 50 }, () => ({ dia_semana: 2, hora_inicio: "16:30", hora_fin: "17:30" }));
    const { rejilla } = construirPayloadHojaFamilias({ config: { ...LYCEO, max_alumnos_por_franja: null }, franjas });
    assert.deepEqual(llenas(rejilla), []);
    assert.equal(rejilla.hayCompletas, false, "y sin marcas no se imprime la leyenda");
  });

  test("sin horario ninguno, la hoja sale igual y sin marcas", () => {
    const { rejilla } = construirPayloadHojaFamilias({ config: { ...LYCEO, max_alumnos_por_franja: 6 } });
    assert.equal(rejilla.hayCompletas, false);
    assert.equal(rejilla.filas.length, 5);
  });

  // ── El nombre ────────────────────────────────────────────────────────

  test("manda el nombre comercial, no el fiscal", () => {
    // En un autónomo, nombre_emisor es el nombre de la persona — no lo que
    // pone en la puerta de la academia.
    const datos = construirPayloadHojaFamilias({ tenantNombre: "Lyceo", config: LYCEO });
    assert.equal(datos.academia, "Lyceo");
  });

  test("sin nombre de centro se cae al fiscal antes que dejar la hoja sin título", () => {
    assert.equal(construirPayloadHojaFamilias({ tenantNombre: "", config: LYCEO }).academia, "Lyceo academia");
  });

  test("sin configuración ninguna no revienta: sale la hoja con el horario por defecto", () => {
    const datos = construirPayloadHojaFamilias({});
    assert.ok(datos.bloques.length > 0);
    assert.deepEqual(datos.contacto, []);
    assert.equal(datos.precios, null);
  });
}
