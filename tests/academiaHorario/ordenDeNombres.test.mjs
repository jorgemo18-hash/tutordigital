import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// Los nombres del cuadrante salen ordenados.
//
// EL PROBLEMA (Jorge, 11/09/2026): *"o por hora, o por orden alfabético o
// algo, pero sí que los nombres estén ordenados"*. El `order` de
// academia.horario.routes.js es por día y hora, así que dentro de una celda
// el orden de los nombres era el que devolviera Postgres: arbitrario, capaz
// de cambiar entre dos cargas, y con seis o siete nombres por hueco hay que
// leerse la celda entera para saber si alguien está.
//
// Las sueltas PARECÍAN ordenadas por hora antes de esto —el martes salía
// "16:30 – 17:00" y luego "17:00 – 17:30"— pero era el orden de la consulta,
// no una garantía del reparto: el mismo `order` que hoy lo deja bien se
// cambia el día que haga falta ordenar por otra cosa. Aquí queda escrito.
export async function run({ test, assert }) {
  const { compararNombres, ordenarPorNombre } = await import(
    "../../assets/shared/js/ordenAlumnos.js"
  );
  const { bloquesDeConfig, repartirEnBloques } = await import(
    "../../assets/shared/js/horarioBloques.js"
  );
  const { buildRejillaCentro } = await import(
    "../../assets/academia/admin/js/sections/horario/rejillaCentro.js"
  );
  const { buildHorarioGrid } = await import("../../assets/academia/profesor/js/horario.js");

  // ── El comparador ─────────────────────────────────────────────────────

  test("ordena en castellano: el acento y la mayúscula no mandan sobre la letra", () => {
    // Comparando cadenas en crudo, "Álex" se va detrás de "Zoe" y "álvaro"
    // detrás de "Ana". Es el caso de Lyceo: hay un Álex y un Aarón.
    assert.deepEqual(
      ordenarPorNombre([{ nombre: "Zoe" }, { nombre: "Álex" }, { nombre: "álvaro" }, { nombre: "Ana" }])
        .map((a) => a.nombre),
      ["Álex", "álvaro", "Ana", "Zoe"]
    );
  });

  test("dos nombres iguales se ordenan por el apellido, que es cuando hace falta", () => {
    assert.deepEqual(
      ordenarPorNombre([{ nombre: "Daniel Sarvisé" }, { nombre: "Daniel Cid" }]).map((a) => a.nombre),
      ["Daniel Cid", "Daniel Sarvisé"]
    );
  });

  test("un nombre vacío o ausente no revienta el orden de los demás", () => {
    const lista = [{ nombre: "Marta" }, {}, { nombre: null }, { nombre: "Ana" }];
    assert.deepEqual(
      ordenarPorNombre(lista).map((a) => a.nombre ?? ""),
      ["", "", "Ana", "Marta"]
    );
  });

  test("REGRESIÓN: devuelve una copia, no ordena la lista que recibe", () => {
    // Las franjas del cuadrante vienen de UNA petición y se reparten en
    // muchas celdas; en el panel de admin se vuelven a filtrar por profesor.
    // Ordenar en el sitio cambiaría la lista que otro trozo está leyendo.
    const original = [{ nombre: "Zoe" }, { nombre: "Ana" }];
    const ordenada = ordenarPorNombre(original);
    assert.equal(original[0].nombre, "Zoe", "la de fuera se queda como estaba");
    assert.notEqual(ordenada, original);
  });

  test("compararNombres sirve de desempate: devuelve 0 con el mismo nombre", () => {
    assert.equal(compararNombres("Ana", "Ana"), 0);
    assert.ok(compararNombres("Ana", "Zoe") < 0);
    assert.ok(compararNombres("Zoe", "Ana") > 0);
  });

  // ── El reparto del cuadrante ──────────────────────────────────────────

  const LYCEO = { franja_inicio: "15:30", franja_fin: "20:30", franja_duracion: 60 };
  const bloques = bloquesDeConfig(LYCEO);
  const f = (hora_inicio, hora_fin, nombre) => ({ hora_inicio, hora_fin, alumno: { nombre } });

  test("los de la fila salen alfabéticos, llegue la consulta como llegue", () => {
    // El jueves de las 16:30 en Lyceo, tal y como lo devolvía la base de
    // datos: Eric, Aarón, Luis, Óscar, Santiago.
    const jueves = [
      f("16:30", "17:30", "Eric"),
      f("16:30", "17:30", "Aarón"),
      f("16:30", "17:30", "Luis"),
      f("16:30", "17:30", "Óscar"),
      f("16:30", "17:30", "Santiago"),
    ];
    const fila = repartirEnBloques(jueves, bloques)[1];
    assert.deepEqual(
      fila.dentro.map((x) => x.alumno.nombre),
      ["Aarón", "Eric", "Luis", "Óscar", "Santiago"]
    );
  });

  test("la cajita va por hora, y a la misma hora alfabética", () => {
    const sueltas = [
      f("17:00", "17:30", "Enara"),
      f("16:30", "17:00", "Rakel"),
      f("16:30", "17:00", "Ixeya"),
    ];
    const fila = repartirEnBloques(sueltas, bloques)[1];
    assert.deepEqual(
      fila.sueltas.map((x) => `${x.hora_inicio} ${x.alumno.nombre}`),
      ["16:30 Ixeya", "16:30 Rakel", "17:00 Enara"],
      "la hora manda: un 17:00 encima de un 16:30 se lee como un error de datos"
    );
  });

  test("REGRESIÓN: dos consultas con las mismas franjas en otro orden pintan lo mismo", () => {
    // Es literalmente la queja: el orden no era una decisión, era lo que
    // devolviera Postgres, y podía cambiar entre dos cargas de la misma
    // pantalla sin que nada hubiera cambiado.
    const franjas = [
      f("17:30", "18:30", "Noah"),
      f("17:30", "18:30", "Rakel"),
      f("18:00", "18:30", "Antonio"),
      f("17:30", "18:30", "Alejandra"),
      f("18:00", "18:30", "Ixeya"),
    ];
    const lee = (reparto) => reparto.map((r) => [
      r.dentro.map((x) => x.alumno.nombre),
      r.sueltas.map((x) => x.alumno.nombre),
    ]);
    assert.deepEqual(
      lee(repartirEnBloques(franjas, bloques)),
      lee(repartirEnBloques([...franjas].reverse(), bloques))
    );
  });

  test("una franja sin hora no esconde a los demás de su celda", () => {
    const rotas = [
      { hora_inicio: null, hora_fin: null, alumno: { nombre: "Dato roto" } },
      f("16:00", "16:30", "Marta"),
    ];
    const reparto = repartirEnBloques(rotas, bloques);
    const nombres = reparto.flatMap((r) => [...r.dentro, ...r.sueltas]).map((x) => x.alumno.nombre);
    assert.ok(nombres.includes("Marta"), "Marta sigue estando en el cuadrante");
    assert.ok(nombres.includes("Dato roto"), "y la rota no desaparece sin decir nada");
  });

  // ── Que llegue a la pantalla ──────────────────────────────────────────

  test("REGRESIÓN: también en el cuadrante del profesor, que es otro pintor", () => {
    // rejillaCentro.js y horario.js/horarioCelda.js dibujan el MISMO reparto
    // con código distinto. Si el orden viviera en el pintor, arreglar uno
    // dejaría el otro desordenado — por eso se ordena en el reparto, y esto
    // lo comprueba por los dos lados.
    const bloques = [{ inicio: "17:30", fin: "18:30" }];
    const franjas = ["Noah", "Alejandra", "Enara"].map((nombre) => ({
      id: nombre, dia_semana: 1, hora_inicio: "17:30", hora_fin: "18:30",
      alumno: { id: nombre, nombre, curso: "1º ESO", nivel: "eso", activo: true },
    }));
    const el = buildHorarioGrid(franjas, [{ value: 1, name: "Lunes" }], bloques);
    assert.deepEqual(
      [...el.querySelectorAll(".ac-slot-name")].map((n) => n.textContent),
      ["Alejandra", "Enara", "Noah"]
    );
  });

  test("REGRESIÓN: el orden llega a la celda pintada, no se pierde en el dibujo", () => {
    // El reparto puede ordenar perfectamente y el pintor recorrer otra cosa.
    // Esto entra por donde entra Jorge.
    const el = buildRejillaCentro({
      franjas: [
        { dia_semana: 1, hora_inicio: "17:30", hora_fin: "18:30", alumno: { id: "1", nombre: "Noah", nivel: "primaria" } },
        { dia_semana: 1, hora_inicio: "17:30", hora_fin: "18:30", alumno: { id: "2", nombre: "Alejandra", nivel: "primaria" } },
        { dia_semana: 1, hora_inicio: "17:30", hora_fin: "18:30", alumno: { id: "3", nombre: "Enara", nivel: "eso" } },
      ],
      config: { ...LYCEO, dias_laborables: [1] },
    });
    const celda = [...el.querySelectorAll(".ach-cell")].find((c) => c.textContent.includes("Noah"));
    assert.deepEqual(
      [...celda.querySelectorAll(".ach-alumno-nombre")].map((n) => n.textContent),
      ["Alejandra", "Enara", "Noah"]
    );
  });
}
