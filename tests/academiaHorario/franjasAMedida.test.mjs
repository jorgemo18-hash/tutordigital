import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// Franjas que no caben en la rejilla: a las 16:15, o de 20:00 a 21:00 en un
// centro que cierra a las 20:30.
//
// Además de la excepción pedida, esto tapa una PÉRDIDA DE DATOS que ya
// existía: una franja cuyo hora_inicio no coincidía con ninguna fila de la
// rejilla no se podía pre-marcar (no hay casilla), así que el siguiente
// guardado de la ficha la borraba sin decir nada. Es justo lo que contaba
// el aviso de "huérfanos" de Ajustes › Horario.
export async function run({ test, assert }) {
  const { buildFranjasAMedida, repartirFranjas, encajaEnRejilla } = await import(
    "../../assets/academia/admin/js/drawer/horario/franjasAMedida.js"
  );
  const { buildHorarioSection } = await import(
    "../../assets/academia/admin/js/drawer/horarioSection.js"
  );

  const HORAS = ["17:00", "17:30", "18:00", "18:30"];
  const CONFIG = { dias_laborables: [1, 2], franja_inicio: "17:00", franja_fin: "19:00", franja_duracion: 60 };
  const click = (el) => el.dispatchEvent(new window.Event("click"));

  // ── Qué cabe y qué no ────────────────────────────────────────────────

  test("una clase alineada con la rejilla encaja", () => {
    assert.equal(encajaEnRejilla({ hora_inicio: "17:00:00", hora_fin: "18:00:00" }, HORAS), true);
  });

  test("una clase que empieza a y cuarto no encaja", () => {
    assert.equal(encajaEnRejilla({ hora_inicio: "17:15", hora_fin: "18:15" }, HORAS), false);
  });

  test("una clase que se sale por el final no encaja, aunque empiece dentro", () => {
    // 18:30-19:30 empieza en una fila de la rejilla pero se pasa del cierre.
    assert.equal(encajaEnRejilla({ hora_inicio: "18:30", hora_fin: "19:30" }, HORAS), false);
  });

  test("repartirFranjas separa las dos cosas sin perder ninguna", () => {
    const { enRejilla, aMedida } = repartirFranjas([
      { hora_inicio: "17:00", hora_fin: "18:00" },
      { hora_inicio: "16:15", hora_fin: "17:15" },
    ], HORAS);
    assert.equal(enRejilla.length, 1);
    assert.equal(aMedida.length, 1);
    assert.equal(aMedida[0].hora_inicio, "16:15");
  });

  // ── El componente ────────────────────────────────────────────────────

  function montar(iniciales = []) {
    return buildFranjasAMedida({
      franjasIniciales: iniciales,
      dias: [{ value: 1, label: "LU" }, { value: 2, label: "MA" }],
      duracionPorDefecto: 60,
    });
  }

  test("las franjas a medida que ya tenía el alumno se enseñan", () => {
    const ctl = montar([{ dia_semana: 2, hora_inicio: "16:15:00", hora_fin: "17:15:00" }]);
    assert.ok(ctl.wrap.textContent.includes("Martes 16:15–17:15"));
    assert.equal(ctl.getFranjas().length, 1);
  });

  test("el formulario está plegado: la rejilla es el camino normal", () => {
    const ctl = montar();
    assert.equal(ctl.wrap.querySelector('input[type="time"]'), null);
    click([...ctl.wrap.querySelectorAll("button")].find((b) => b.textContent.includes("Franja a medida")));
    assert.ok(ctl.wrap.querySelector('input[type="time"]'), "al abrirlo aparece el formulario");
  });

  function abrirYRellenar(ctl, { dia = "1", hora = "16:15", duracion = "60" } = {}) {
    click([...ctl.wrap.querySelectorAll("button")].find((b) => b.textContent.includes("Franja a medida")));
    ctl.wrap.querySelector("select").value = dia;
    ctl.wrap.querySelector('input[type="time"]').value = hora;
    ctl.wrap.querySelector('input[type="number"]').value = duracion;
    click([...ctl.wrap.querySelectorAll("button")].find((b) => b.textContent === "Añadir"));
  }

  test("añadir una franja de 60 min calcula su hora de fin", () => {
    const ctl = montar();
    abrirYRellenar(ctl, { dia: "2", hora: "16:15", duracion: "60" });
    assert.deepEqual(ctl.getFranjas(), [
      { dia_semana: 2, hora_inicio: "16:15", hora_fin: "17:15", profesor_id: null },
    ]);
  });

  test("sin hora no se añade nada, y se dice por qué", () => {
    const ctl = montar();
    abrirYRellenar(ctl, { hora: "" });
    assert.deepEqual(ctl.getFranjas(), []);
    assert.ok(/Falta la hora/.test(ctl.wrap.textContent));
  });

  test("una duración de cero tampoco cuela", () => {
    const ctl = montar();
    abrirYRellenar(ctl, { duracion: "0" });
    assert.deepEqual(ctl.getFranjas(), []);
    assert.ok(/mayor que cero/.test(ctl.wrap.textContent));
  });

  test("se puede quitar una franja a medida", () => {
    const ctl = montar([{ dia_semana: 1, hora_inicio: "16:15", hora_fin: "17:15" }]);
    click([...ctl.wrap.querySelectorAll("button")].find((b) => b.textContent === "Quitar"));
    assert.deepEqual(ctl.getFranjas(), []);
  });

  // ── Integradas en la ficha del alumno ────────────────────────────────

  test("REGRESIÓN: una franja fuera de la rejilla YA NO se pierde al guardar", () => {
    // Antes desaparecía en silencio: no había casilla que marcar, así que
    // getValue() no la devolvía y el guardado la borraba.
    const seccion = buildHorarioSection({
      config: CONFIG,
      horarioActual: [
        { dia_semana: 1, hora_inicio: "17:00:00", hora_fin: "18:00:00", profesor_id: null },
        { dia_semana: 2, hora_inicio: "16:15:00", hora_fin: "17:15:00", profesor_id: null },
      ],
    });
    const valores = seccion.getValue();
    assert.equal(valores.length, 2, "la de la rejilla Y la de a medida");
    assert.ok(valores.some((v) => v.hora_inicio === "16:15" && v.hora_fin === "17:15"));
  });

  test("una franja a medida conserva su profesor", () => {
    const seccion = buildHorarioSection({
      config: CONFIG,
      horarioActual: [{ dia_semana: 2, hora_inicio: "16:15", hora_fin: "17:15", profesor_id: "p-maria" }],
      profesores: [{ id: "p-maria", display_name: "María" }, { id: "p-pedro", display_name: "Pedro" }],
    });
    assert.equal(seccion.getValue()[0].profesor_id, "p-maria");
  });

  test("el resumen de debajo de la rejilla también las nombra", () => {
    const seccion = buildHorarioSection({
      config: CONFIG,
      horarioActual: [{ dia_semana: 2, hora_inicio: "16:15", hora_fin: "17:15" }],
    });
    assert.ok(seccion.wrap.textContent.includes("Martes 16:15–17:15"));
  });
}
