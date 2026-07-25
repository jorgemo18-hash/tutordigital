import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// Vista personal del profesor: si el backend dice sinAlumnosAsignados
// (ver academia.horario.routes.js), el horario debe mostrar un mensaje
// explícito en vez de una rejilla vacía sin explicación.
export async function run({ test, assert }) {
  const { renderHorario } = await import("../../assets/academia/profesor/js/horario.js");

  test("sinAlumnosAsignados -> mensaje explícito, no una rejilla vacía", async () => {
    const container = document.createElement("div");
    await renderHorario(container, {
      fetchHorarioFn: async () => ({ franjas: [], sinAlumnosAsignados: true }),
      fetchConfigFn: async () => ({ dias_laborables: [1, 2, 3, 4, 5], franja_inicio: "16:00", franja_fin: "20:00", franja_duracion: 60 }),
    });
    assert.ok(container.textContent.includes("No tienes alumnos asignados"));
    assert.equal(container.querySelector(".ac-grid"), null, "no debe montar la rejilla si no hay alumnos asignados");
  });

  test("con franjas -> monta la rejilla normalmente, sin el mensaje de sin-alumnos", async () => {
    const container = document.createElement("div");
    await renderHorario(container, {
      fetchHorarioFn: async () => ({
        franjas: [{
          id: "h1", dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00",
          alumno: { id: "a1", nombre: "Ana", curso: "1 ESO", nivel: "eso", activo: true },
        }],
        sinAlumnosAsignados: false,
      }),
      fetchConfigFn: async () => ({ dias_laborables: [1, 2, 3, 4, 5], franja_inicio: "16:00", franja_fin: "20:00", franja_duracion: 60 }),
    });
    assert.ok(container.querySelector(".ac-grid"));
    assert.equal(container.textContent.includes("No tienes alumnos asignados"), false);
  });

  test("sin alumnos asignados pero fetchConfig falla -> igual muestra el mensaje (no revienta)", async () => {
    const container = document.createElement("div");
    await renderHorario(container, {
      fetchHorarioFn: async () => ({ franjas: [], sinAlumnosAsignados: true }),
      fetchConfigFn: async () => { throw new Error("fallo de red"); },
    });
    assert.ok(container.textContent.includes("No tienes alumnos asignados"));
  });
}
