// Ocupación de las franjas del horario del centro.
//
// El admin asignaba franjas a ciegas: la rejilla del drawer marca casillas
// pero no decía cuántos alumnos había ya en cada hora, y esa decisión se
// toma justo ahí, rellenando la ficha.
//
// La lógica existe dos veces —server/lib/academiaHorario/ocupacion.js y
// assets/.../drawer/horario/ocupacionCliente.js— porque el navegador no
// puede importar desde server/. Estos tests importan LAS DOS y comprueban
// que dan el mismo resultado, para que no se separen en silencio.
export async function run({ test, assert }) {
  const servidor = await import("../../server/lib/academiaHorario/ocupacion.js");
  const cliente = await import("../../assets/academia/admin/js/drawer/horario/ocupacionCliente.js");
  const impls = [["servidor", servidor], ["cliente", cliente]];

  const franjas = [
    { dia_semana: 2, hora_inicio: "17:00:00", alumno: { id: "a1", activo: true } },
    { dia_semana: 2, hora_inicio: "17:00:00", alumno: { id: "a2", activo: true } },
    { dia_semana: 2, hora_inicio: "17:00:00", alumno: { id: "a3", activo: true } },
    { dia_semana: 2, hora_inicio: "18:00:00", alumno: { id: "a1", activo: true } },
    { dia_semana: 4, hora_inicio: "17:00:00", alumno: { id: "a2", activo: true } },
  ];

  for (const [nombre, m] of impls) {
    test(`[${nombre}] claveFranja normaliza el time de Postgres a HH:MM`, () => {
      assert.equal(m.claveFranja(2, "17:00:00"), "2|17:00");
      assert.equal(m.claveFranja("2", "17:00"), "2|17:00", "misma clave desde el formulario");
    });

    test(`[${nombre}] cuenta los alumnos de cada franja`, () => {
      const c = m.contarOcupacion(franjas);
      assert.equal(c.get("2|17:00"), 3);
      assert.equal(c.get("2|18:00"), 1);
      assert.equal(c.get("4|17:00"), 1);
      assert.equal(c.get("3|17:00"), undefined, "una franja sin nadie no aparece");
    });

    test(`[${nombre}] REGRESIÓN: las franjas del propio alumno no cuentan como ajenas`, () => {
      // Al editar la ficha de a1, lo que necesita saber el admin es cuántos
      // OTROS hay en esa hora — si no, se contaría a sí mismo y el número
      // subiría al reabrir su propia ficha.
      const c = m.contarOcupacion(franjas, { excluirAlumnoId: "a1" });
      assert.equal(c.get("2|17:00"), 2);
      assert.equal(c.get("2|18:00"), undefined, "era el único ahí");
    });

    test(`[${nombre}] REGRESIÓN: una clase larga ocupa TODAS sus medias horas`, () => {
      // Contando solo por hora de inicio, una clase de 17:00 a 18:30
      // dejaba las 17:30 y las 18:00 como si el aula estuviera vacía.
      const larga = [{ dia_semana: 1, hora_inicio: "17:00:00", hora_fin: "18:30:00", alumno: { id: "a1" } }];
      const conteo = m.contarOcupacion(larga);
      assert.equal(conteo.get("1|17:00"), 1);
      assert.equal(conteo.get("1|17:30"), 1);
      assert.equal(conteo.get("1|18:00"), 1);
      assert.equal(conteo.get("1|18:30"), undefined, "a las 18:30 ya ha salido");
    });

    test(`[${nombre}] REGRESIÓN: dos alumnos solapados a medias se cuentan juntos donde coinciden`, () => {
      // 16:00-17:00 y 16:30-17:30 comparten aula media hora. Por hora de
      // inicio no coincidían nunca y el aviso de "franja llena" mentía.
      const solapados = [
        { dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00", alumno: { id: "a1" } },
        { dia_semana: 1, hora_inicio: "16:30", hora_fin: "17:30", alumno: { id: "a2" } },
      ];
      const conteo = m.contarOcupacion(solapados);
      assert.equal(conteo.get("1|16:00"), 1);
      assert.equal(conteo.get("1|16:30"), 2, "la media hora que comparten");
      assert.equal(conteo.get("1|17:00"), 1);
    });

    test(`[${nombre}] una fila sin hora_fin sigue contando su tramo de inicio`, () => {
      // Datos antiguos o a medias: en el peor caso, lo de antes.
      const conteo = m.contarOcupacion([{ dia_semana: 3, hora_inicio: "17:00:00", alumno: { id: "a1" } }]);
      assert.equal(conteo.get("3|17:00"), 1);
    });

    test(`[${nombre}] acepta filas con alumno_id plano, sin embed`, () => {
      const c = m.contarOcupacion([{ dia_semana: 1, hora_inicio: "16:00", alumno_id: "x" }]);
      assert.equal(c.get("1|16:00"), 1);
    });

    test(`[${nombre}] sin franjas -> mapa vacío, no revienta`, () => {
      assert.equal(m.contarOcupacion().size, 0);
      assert.equal(m.contarOcupacion(null).size, 0);
    });

    test(`[${nombre}] alumnosSinHorario: los que no tienen ninguna franja vigente`, () => {
      const alumnos = [
        { id: "a1", nombre: "Ana", activo: true },
        { id: "a2", nombre: "Luis", activo: true },
        { id: "a9", nombre: "Nuevo de octubre", activo: true },
      ];
      assert.deepEqual(m.alumnosSinHorario(alumnos, franjas).map((a) => a.id), ["a9"]);
    });

    test(`[${nombre}] alumnosSinHorario: un archivado no cuenta como pendiente`, () => {
      const alumnos = [{ id: "a9", activo: true }, { id: "a8", activo: false }];
      assert.deepEqual(m.alumnosSinHorario(alumnos, []).map((a) => a.id), ["a9"]);
    });

    test(`[${nombre}] estadoFranja: sin máximo definido nunca hay "lleno"`, () => {
      assert.equal(m.estadoFranja(0, null), "libre");
      assert.equal(m.estadoFranja(9, null), "ocupada");
      assert.equal(m.estadoFranja(9, 0), "ocupada", "0 se trata como sin límite");
    });

    test(`[${nombre}] estadoFranja: con máximo, avisa al llegar y al pasarse`, () => {
      assert.equal(m.estadoFranja(0, 5), "libre");
      assert.equal(m.estadoFranja(3, 5), "ocupada");
      assert.equal(m.estadoFranja(5, 5), "lleno");
      assert.equal(m.estadoFranja(6, 5), "excedido", "superarlo es posible: el límite avisa, no bloquea");
    });
  }

  test("las dos implementaciones dan exactamente lo mismo", () => {
    const casos = [
      [franjas, {}],
      [franjas, { excluirAlumnoId: "a2" }],
      [[], {}],
    ];
    for (const [f, opts] of casos) {
      assert.deepEqual(
        [...servidor.contarOcupacion(f, opts).entries()].sort(),
        [...cliente.contarOcupacion(f, opts).entries()].sort()
      );
    }
    for (const [o, max] of [[0, null], [3, 5], [5, 5], [6, 5], [2, null]]) {
      assert.equal(servidor.estadoFranja(o, max), cliente.estadoFranja(o, max), `ocupados=${o} max=${max}`);
    }
  });
}
