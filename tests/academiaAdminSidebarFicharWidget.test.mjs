import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// Widget persistente en el sidebar (junto a "Tema"/"Cerrar sesión") —
// visible en TODAS las secciones, no solo dentro de "Control horario",
// cuando el tenant activó el control horario. Sin ese toggle, no debe
// montarse nada.
export async function run({ test, assert }) {
  const { buildSidebar } = await import("../assets/academia/admin/js/sidebar.js");

  function montar(overrides = {}) {
    return buildSidebar({
      activeId: "alumnos",
      onSelect: () => {}, onThemeToggle: () => {}, onLogout: () => {},
      ...overrides,
    });
  }

  test("sin controlHorarioActivo, el sidebar NO monta el widget persistente de fichar", () => {
    const { wrap } = montar();
    assert.equal(wrap.querySelector(".ac-fichaje-punto"), null);
  });

  test("con controlHorarioActivo, el sidebar monta el widget en ac-sidebar-bottom", async () => {
    const { wrap } = montar({
      controlHorarioActivo: true,
      ficharWidgetDeps: {
        fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
        ficharFnDep: async () => {},
      },
    });
    const widget = wrap.querySelector(".ac-sidebar-bottom .ac-fichaje-punto");
    assert.ok(widget, "debe montarse dentro de ac-sidebar-bottom");
  });
}
