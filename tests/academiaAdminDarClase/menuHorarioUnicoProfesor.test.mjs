import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// "Horario" salía dos veces en el menú de una academia de una sola persona:
// la sección del menú (el cuadrante del CENTRO) y "Dar clase › Horario"
// (MIS clases). Con un único profesor son la misma pantalla con los mismos
// alumnos — Jorge, 02/09: "cuando solo hay un profesor no tiene sentido
// tenerlo dos veces, quita horario de la columna principal y déjalo solo en
// dar clase".
//
// Lo que NO puede pasar por esconderla: quedarse sin cuadrante (un admin
// que no da clase no tiene otro), ni perder la lista de alumnos sin horario,
// que era lo único que la sección del menú tenía y "Dar clase" no.
export async function run({ test, assert }) {
  const { seccionesAdmin } = await import("../../assets/academia/admin/js/sidebar.js");
  const { esUnicoProfesor, hayUnSoloProfesor } = await import(
    "../../assets/academia/admin/js/plantilla.js"
  );
  const { createDarClaseSection } = await import(
    "../../assets/academia/admin/js/sections/darClaseSection.js"
  );

  const ids = (config, opts) => seccionesAdmin(config, opts).map((s) => s.id);
  const DA_CLASE = { admin_imparte_clases: true };

  // ── Cuándo se esconde ─────────────────────────────────────────────────

  test("un solo profesor + el admin da clase: Horario se va del menú, Dar clase se queda", () => {
    const lista = ids(DA_CLASE, { unicoProfesor: true });
    assert.equal(lista.includes("horario"), false);
    assert.ok(lista.includes("dar_clase"));
  });

  test("REGRESIÓN: con dos profesores NO se esconde — dejan de ser la misma pantalla", () => {
    // El cuadrante del centro pasa a tener franjas que no son mías, y "Dar
    // clase" sigue enseñando solo las mías (ambito=profesor).
    assert.ok(ids(DA_CLASE, { unicoProfesor: false }).includes("horario"));
    assert.ok(ids(DA_CLASE).includes("horario"), "sin pasar el dato, no se esconde nada");
  });

  test("REGRESIÓN: si el admin NO da clase, Horario se queda aunque haya un solo profesor", () => {
    // Es la única vista de horario que tiene: esconderla lo dejaría sin
    // cuadrante ninguno.
    const lista = ids({}, { unicoProfesor: true });
    assert.ok(lista.includes("horario"));
    assert.equal(lista.includes("dar_clase"), false);
  });

  test("esconderlo no descoloca el resto del menú", () => {
    const lista = ids({ ...DA_CLASE, control_horario_activo: true }, { unicoProfesor: true });
    assert.equal(lista[lista.indexOf("alumnos") + 1], "profesores", "adyacencia de siempre");
    assert.equal(lista[lista.indexOf("profesores") + 1], "dar_clase", "ocupa el hueco de Horario");
    assert.equal(lista[lista.length - 1], "fichajes", "Control horario sigue al final");
  });

  // ── Contar la plantilla ───────────────────────────────────────────────

  test("un profesor dado de baja no cuenta: la academia sigue siendo de una persona", () => {
    assert.equal(esUnicoProfesor([{ is_active: true }]), true);
    assert.equal(esUnicoProfesor([{ is_active: true }, { is_active: false }]), true);
    assert.equal(esUnicoProfesor([{ is_active: true }, { is_active: true }]), false);
  });

  test("cero profesores registrados también es 'uno solo'", () => {
    // El admin que da clase sin haberse dado de alta como profesor.
    assert.equal(esUnicoProfesor([]), true);
    assert.equal(esUnicoProfesor(null), true);
  });

  test("si falla la petición NO se esconde nada", async () => {
    // Esconder una sección por un error de red es peor que enseñar una de
    // más: el admin la busca, no la encuentra y cree que ha perdido su
    // horario.
    const res = await hayUnSoloProfesor({
      fetchProfesoresFn: async () => { throw new Error("500"); },
    });
    assert.equal(res, false);
  });

  test("caso Lyceo: un profesor activo -> true", async () => {
    assert.equal(await hayUnSoloProfesor({ fetchProfesoresFn: async () => [{ is_active: true }] }), true);
  });

  // ── Lo que no se puede perder al esconderla ───────────────────────────

  function montar(opts = {}) {
    const llamadas = { horario: [], diario: [], sinHorario: [] };
    const section = createDarClaseSection({
      renderHorarioFn: async (el) => { llamadas.horario.push(el); },
      renderDiarioFn: async (el) => { llamadas.diario.push(el); },
      renderSinHorarioFn: async (el) => { llamadas.sinHorario.push(el); },
      ...opts,
    });
    return { section, llamadas };
  }

  test("la lista de alumnos sin horario se pinta debajo del horario en Dar clase", async () => {
    const { section, llamadas } = montar({ mostrarSinHorario: true });
    const container = document.createElement("div");
    await section.render(container);
    assert.equal(llamadas.sinHorario.length, 1, "el aviso de altas sin cuadrar no se pierde");
    assert.notEqual(llamadas.sinHorario[0], llamadas.horario[0],
      "en su propio hueco: el horario se vacía solo al cambiar de semana y se lo llevaría por delante");
  });

  test("en el Diario no se pinta: ahí no se cuadra el horario", async () => {
    const { section, llamadas } = montar({ mostrarSinHorario: true });
    const container = document.createElement("div");
    await section.render(container);
    [...container.querySelectorAll(".ac-list-tab")].find((b) => b.textContent === "Diario").click();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(llamadas.sinHorario.length, 1, "no se repinta al cambiar de pestaña");
  });

  test("con varios profesores no se pinta: la sección Horario del menú sigue ahí", async () => {
    const { section, llamadas } = montar();
    await section.render(document.createElement("div"));
    assert.equal(llamadas.sinHorario.length, 0);
  });
}
