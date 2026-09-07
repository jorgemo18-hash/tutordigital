// Los tramos horarios del diario: dónde va la raya que separa una hora de
// la siguiente.
//
// Lo que se vigila aquí no es "que agrupe", es que agrupe SIN REORDENAR. La
// lista llega ya ordenada del backend (por hora_inicio, y los alumnos sin
// horario al final); si esto ordenara por su cuenta habría dos fuentes de
// verdad sobre el orden del diario y en cuanto discreparan nadie sabría cuál
// manda.
export async function run({ test, assert }) {
  const { agruparPorHora } = await import("../../assets/academia/profesor/js/diarioGrupos.js");

  const hora = (e) => e.hora;
  const formas = (grupos) => grupos.map((g) => [g.hora, g.entradas.length]);

  test("una tarde real: tres alumnos a las 17:30 son UN tramo, no tres", () => {
    const lista = [
      { hora: "15:30", n: "Daniel" }, { hora: "15:30", n: "Alejandra" },
      { hora: "16:30", n: "Eric" },
      { hora: "17:30", n: "Rakel" }, { hora: "17:30", n: "Antonio" }, { hora: "17:30", n: "Noah" },
    ];
    assert.deepEqual(formas(agruparPorHora(lista, hora)), [["15:30", 2], ["16:30", 1], ["17:30", 3]]);
  });

  test("no reordena: las entradas salen en el mismo orden en que entraron", () => {
    const lista = [{ hora: "17:30", n: "B" }, { hora: "17:30", n: "A" }, { hora: "18:30", n: "C" }];
    assert.deepEqual(
      agruparPorHora(lista, hora).flatMap((g) => g.entradas.map((e) => e.n)),
      ["B", "A", "C"]
    );
  });

  test("REGRESIÓN: una hora que vuelve a aparecer más abajo NO se fusiona con la de arriba", () => {
    // Solo se agrupan entradas CONSECUTIVAS. Fusionarlas movería una tarjeta
    // de sitio en la pantalla, que es justo lo que no puede hacer un
    // separador visual.
    const lista = [{ hora: "17:30" }, { hora: "18:30" }, { hora: "17:30" }];
    assert.deepEqual(formas(agruparPorHora(lista, hora)), [["17:30", 1], ["18:30", 1], ["17:30", 1]]);
  });

  test("los alumnos sin horario ('Extra') hacen su propio tramo al final", () => {
    const lista = [{ hora: "18:30" }, { hora: "Extra" }, { hora: "Extra" }];
    assert.deepEqual(formas(agruparPorHora(lista, hora)), [["18:30", 1], ["Extra", 2]]);
  });

  test("lista vacía o sin argumentos: ningún grupo, y no revienta", () => {
    assert.deepEqual(agruparPorHora([], hora), []);
    assert.deepEqual(agruparPorHora(), []);
  });

  test("un solo alumno es un solo tramo — y por tanto NINGUNA raya", () => {
    // Quien pinta dibuja la raya solo entre grupos: con un grupo, cero rayas.
    assert.equal(agruparPorHora([{ hora: "15:30" }], hora).length, 1);
  });
}
