import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// Vista personal del profesor: si el backend dice sinAlumnosAsignados
// (ver academia.sesiones.routes.js), el diario debe mostrar un mensaje
// distinto del genérico "Sin alumnos con clase este día" — ese último es
// normal incluso con alumnos asignados (fin de semana, sin horario ese
// día); "sin alumnos asignados" es un problema estructural distinto.
export async function run({ test, assert }) {
  const { renderDiario } = await import("../../assets/academia/profesor/js/diario.js");

  test("sinAlumnosAsignados -> mensaje explícito de 'pide que te asignen alumnos'", async () => {
    const container = document.createElement("div");
    await renderDiario(container, {
      fetchDiarioFn: async () => ({ alumnos: [], sinAlumnosAsignados: true }),
      fechaInicial: "2026-07-27",
    });
    assert.ok(container.textContent.includes("No tienes alumnos asignados"));
  });

  test("lista vacía pero CON alumnos asignados -> mensaje genérico de 'sin clase este día', no el de asignación", async () => {
    const container = document.createElement("div");
    await renderDiario(container, {
      fetchDiarioFn: async () => ({ alumnos: [], sinAlumnosAsignados: false }),
      fechaInicial: "2026-07-27",
    });
    assert.ok(container.textContent.includes("Sin alumnos con clase este día"));
    assert.equal(container.textContent.includes("No tienes alumnos asignados"), false);
  });

  test("con alumnos en la lista -> no muestra ningún mensaje de vacío", async () => {
    const container = document.createElement("div");
    await renderDiario(container, {
      fetchDiarioFn: async () => ({
        alumnos: [{ alumno_id: "a1", nombre: "Ana", curso: "1 ESO", nivel: "eso", horarios: [{ hora_inicio: "16:00", hora_fin: "17:00" }], sesion: null }],
        sinAlumnosAsignados: false,
      }),
      fechaInicial: "2026-07-27",
    });
    assert.equal(container.textContent.includes("No tienes alumnos asignados"), false);
    assert.equal(container.textContent.includes("Sin alumnos con clase este día"), false);
  });

  test("cubriendo a alguien hoy -> muestra el aviso en el diario", async () => {
    const container = document.createElement("div");
    await renderDiario(container, {
      fetchDiarioFn: async () => ({ alumnos: [], sinAlumnosAsignados: false }),
      fetchMisSustitucionesFn: async () => [{ soy_sustituto: true, sustituido_nombre: "Bea" }],
      fechaInicial: "2026-07-27",
    });
    assert.ok(container.textContent.includes("Hoy cubres a Bea"));
  });

  test("el aviso persiste al navegar de fecha (no se pide de nuevo por cada flecha)", async () => {
    const container = document.createElement("div");
    let vecesPedido = 0;
    await renderDiario(container, {
      fetchDiarioFn: async () => ({ alumnos: [], sinAlumnosAsignados: false }),
      fetchMisSustitucionesFn: async () => { vecesPedido++; return [{ soy_sustituto: true, sustituido_nombre: "Bea" }]; },
      fechaInicial: "2026-07-27",
    });
    assert.ok(container.textContent.includes("Hoy cubres a Bea"));

    const prevBtn = container.querySelector(".ac-date-arrow");
    prevBtn.dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("Hoy cubres a Bea"), "sigue mostrándose tras cambiar de fecha");
    assert.equal(vecesPedido, 1, "no debe volver a pedirse en cada cambio de fecha");
  });

  test("si fetchMisSustitucionesFn falla, no revienta el diario (el aviso simplemente no aparece)", async () => {
    const container = document.createElement("div");
    await renderDiario(container, {
      fetchDiarioFn: async () => ({ alumnos: [], sinAlumnosAsignados: false }),
      fetchMisSustitucionesFn: async () => { throw new Error("fallo de red"); },
      fechaInicial: "2026-07-27",
    });
    assert.ok(container.textContent.includes("Sin alumnos con clase este día"));
    assert.equal(container.querySelector(".ac-nota"), null);
  });
}
