// Agrupar y filtrar el horario del centro por quién imparte cada franja
// (paso 2 de la migración 109).
//
// El profesor vive en la franja, no se deduce de las asignaciones del
// alumno: por eso un mismo alumno puede salir bajo María el martes y bajo
// Pedro el jueves.
export async function run({ test, assert }) {
  const {
    TODOS, SIN_ASIGNAR, ETIQUETA_SIN_ASIGNAR,
    profesoresConFranjas, haySinAsignar, tieneSentidoElSelector,
    filtrarPorProfesor, gruposDeHorario, opcionesDeProfesor,
  } = await import("../../assets/academia/admin/js/sections/horario/agrupacionProfesor.js");

  const f = (id, alumno, profesor) => ({
    id, dia_semana: 1, hora_inicio: "17:00",
    alumno: { id: alumno, nombre: alumno },
    profesor_id: profesor?.id || null,
    profesor: profesor || null,
  });
  const MARIA = { id: "p-maria", display_name: "María" };
  const PEDRO = { id: "p-pedro", display_name: "Pedro" };

  const MIXTO = [
    f("1", "Ana", PEDRO),
    f("2", "Luis", MARIA),
    f("3", "Marta", MARIA),
    f("4", "Huérfano", null),
  ];

  test("los profesores salen ordenados por nombre, sin repetir", () => {
    assert.deepEqual(profesoresConFranjas(MIXTO).map((p) => p.nombre), ["María", "Pedro"]);
  });

  test("un profesor SIN clases no aparece en el selector", () => {
    // Se sacan de las franjas, no de la plantilla del centro: su rejilla
    // saldría vacía y solo añade una opción muerta.
    const soloMaria = [f("1", "Ana", MARIA)];
    assert.deepEqual(profesoresConFranjas(soloMaria).map((p) => p.id), ["p-maria"]);
  });

  test("REGRESIÓN: si nadie tiene profesor puesto, NO se pinta selector", () => {
    // Es el caso de una academia de una persona que nunca ha rellenado el
    // campo, y de cualquier centro anterior a la migración 109: un
    // desplegable con una sola opción es ruido.
    assert.equal(tieneSentidoElSelector([f("1", "Ana", null), f("2", "Luis", null)]), false);
    assert.equal(tieneSentidoElSelector([]), false);
    assert.equal(tieneSentidoElSelector(MIXTO), true);
  });

  test("filtrar por un profesor deja solo sus franjas", () => {
    assert.deepEqual(filtrarPorProfesor(MIXTO, "p-maria").map((x) => x.alumno.nombre), ["Luis", "Marta"]);
  });

  test("filtrar por 'sin asignar' deja solo las huérfanas", () => {
    assert.deepEqual(filtrarPorProfesor(MIXTO, SIN_ASIGNAR).map((x) => x.alumno.nombre), ["Huérfano"]);
  });

  test("'Todos' no filtra nada", () => {
    assert.equal(filtrarPorProfesor(MIXTO, TODOS).length, 4);
  });

  test("con 'Todos' se agrupa: una rejilla por profesor, con su nombre", () => {
    const grupos = gruposDeHorario(MIXTO, TODOS);
    assert.deepEqual(grupos.map((g) => g.titulo), ["María", "Pedro", ETIQUETA_SIN_ASIGNAR]);
    assert.deepEqual(grupos[0].franjas.map((x) => x.alumno.nombre), ["Luis", "Marta"]);
  });

  test("REGRESIÓN: las franjas sin profesor se muestran, no se esconden", () => {
    // Son justamente los huecos que hay que resolver al cuadrar el curso.
    // Filtrarlas fuera las volvería invisibles.
    const grupos = gruposDeHorario(MIXTO, TODOS);
    const sueltas = grupos.find((g) => g.titulo === ETIQUETA_SIN_ASIGNAR);
    assert.ok(sueltas, "tiene su propio grupo");
    assert.deepEqual(sueltas.franjas.map((x) => x.alumno.nombre), ["Huérfano"]);
    assert.equal(grupos.indexOf(sueltas), grupos.length - 1, "al final: son la excepción");
  });

  test("si no hay ninguna sin asignar, no se inventa un grupo vacío", () => {
    const todas = [f("1", "Ana", MARIA), f("2", "Luis", PEDRO)];
    assert.deepEqual(gruposDeHorario(todas, TODOS).map((g) => g.titulo), ["María", "Pedro"]);
  });

  test("elegir un profesor concreto da UN grupo y sin título", () => {
    // Una cabecera encima de una sola rejilla, cuando el desplegable ya
    // dice a quién estás mirando, es ruido.
    const grupos = gruposDeHorario(MIXTO, "p-pedro");
    assert.equal(grupos.length, 1);
    assert.equal(grupos[0].titulo, null);
    assert.deepEqual(grupos[0].franjas.map((x) => x.alumno.nombre), ["Ana"]);
  });

  test("sin ningún profesor asignado: una sola rejilla, como antes", () => {
    const ninguno = [f("1", "Ana", null), f("2", "Luis", null)];
    const grupos = gruposDeHorario(ninguno, TODOS);
    assert.equal(grupos.length, 1);
    assert.equal(grupos[0].titulo, null, "sin cabecera: no hay nada que distinguir");
    assert.equal(grupos[0].franjas.length, 2);
  });

  test("un mismo alumno puede salir bajo dos profesores distintos", () => {
    // Es exactamente el caso que la columna vino a resolver: martes con
    // María, jueves con Pedro.
    const marta = [
      { ...f("1", "Marta", MARIA), dia_semana: 2 },
      { ...f("2", "Marta", PEDRO), dia_semana: 4 },
    ];
    const grupos = gruposDeHorario(marta, TODOS);
    assert.equal(grupos.length, 2);
    assert.ok(grupos.every((g) => g.franjas.length === 1));
  });

  test("acepta franjas con profesor_id plano, sin el objeto embebido", () => {
    const plana = [{ id: "1", profesor_id: "p-maria", alumno: { id: "a", nombre: "Ana" } }];
    assert.deepEqual(filtrarPorProfesor(plana, "p-maria").length, 1);
    assert.equal(haySinAsignar(plana), false);
  });

  test("las opciones del desplegable van en orden y sin las que sobran", () => {
    assert.deepEqual(opcionesDeProfesor(MIXTO).map((o) => o.value), [TODOS, "p-maria", "p-pedro", SIN_ASIGNAR]);
    const todasAsignadas = [f("1", "Ana", MARIA)];
    assert.deepEqual(opcionesDeProfesor(todasAsignadas).map((o) => o.value), [TODOS, "p-maria"], "sin 'sin asignar' si no hay ninguna");
  });

  test("nada de esto revienta con la lista vacía", () => {
    assert.deepEqual(profesoresConFranjas([]), []);
    assert.deepEqual(opcionesDeProfesor([]).map((o) => o.value), [TODOS]);
    assert.equal(gruposDeHorario([], TODOS)[0].franjas.length, 0);
    assert.deepEqual(gruposDeHorario(undefined, TODOS)[0].franjas, []);
  });
}
