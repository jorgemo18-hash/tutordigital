import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// REGRESIÓN — el Diario ya permite avanzar más allá de "hoy" (para marcar
// ausencias anticipadas), pero sigue teniendo un tope (RANGO_DIAS_ADELANTE,
// ver diarioFechas.js) en vez de quedar sin límite.
export async function run({ test, assert }) {
  const { renderDiario } = await import("../../assets/academia/profesor/js/diario.js");
  const { todayISO, shiftISO, RANGO_DIAS_ADELANTE } = await import("../../assets/academia/profesor/js/diarioFechas.js");

  function nextBtnDe(container) {
    return container.querySelectorAll(".ac-date-arrow")[1];
  }

  test("en la fecha de hoy, la flecha 'siguiente' ya NO está deshabilitada", async () => {
    const container = document.createElement("div");
    await renderDiario(container, {
      fetchDiarioFn: async () => ({ alumnos: [], sinAlumnosAsignados: true }),
      fechaInicial: todayISO(),
    });
    assert.equal(nextBtnDe(container).disabled, false);
  });

  test("justo en el límite de avance -> la flecha 'siguiente' se deshabilita", async () => {
    const container = document.createElement("div");
    const fechaLimite = shiftISO(todayISO(), RANGO_DIAS_ADELANTE);
    await renderDiario(container, {
      fetchDiarioFn: async () => ({ alumnos: [], sinAlumnosAsignados: true }),
      fechaInicial: fechaLimite,
    });
    assert.equal(nextBtnDe(container).disabled, true);
  });

  test("un día antes del límite -> la flecha 'siguiente' sigue habilitada", async () => {
    const container = document.createElement("div");
    const fechaAntes = shiftISO(todayISO(), RANGO_DIAS_ADELANTE - 1);
    await renderDiario(container, {
      fetchDiarioFn: async () => ({ alumnos: [], sinAlumnosAsignados: true }),
      fechaInicial: fechaAntes,
    });
    assert.equal(nextBtnDe(container).disabled, false);
  });
}
