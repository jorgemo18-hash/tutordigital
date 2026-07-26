import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// "Fichar" no es una tab: fichar entrada/salida vive en el FAB
// persistente (ver tests/fichaje/ficharFab.test.mjs), no en la
// navegación del panel. Horario/Diario son las únicas tabs, siempre en
// ese orden, y Horario es la de por defecto.
export async function run({ test, assert }) {
  const { TABS, buildHeader } = await import("../assets/academia/profesor/js/tabsHeader.js");

  test("TABS es Horario y Diario, en ese orden, sin Fichar ni Sustituciones", () => {
    assert.deepEqual(TABS.map((t) => t.id), ["horario", "diario"]);
  });

  test("ninguna tab lleva la clase 'destacado'", () => {
    const shell = document.createElement("div");
    const { tabButtons } = buildHeader(shell, {
      who: "Ana", academia: "Academia Demo", tabsList: TABS,
      onTabSelect: () => {}, onThemeToggle: () => {}, onLogout: () => {},
    });
    assert.equal(tabButtons.get("horario").className, "ac-tab");
    assert.equal(tabButtons.get("diario").className, "ac-tab");
  });

  test("clic en un botón de tab llama a onTabSelect con su id", () => {
    const shell = document.createElement("div");
    let seleccionado = null;
    const { tabButtons } = buildHeader(shell, {
      who: "Ana", academia: "Academia Demo", tabsList: TABS,
      onTabSelect: (id) => { seleccionado = id; }, onThemeToggle: () => {}, onLogout: () => {},
    });
    tabButtons.get("diario").dispatchEvent(new window.Event("click"));
    assert.equal(seleccionado, "diario");
  });

  test("la cabecera no monta ningún acceso de fichar (vive en el FAB, fuera del header)", () => {
    const shell = document.createElement("div");
    const { header } = buildHeader(shell, {
      who: "Ana", academia: "Academia Demo", tabsList: TABS,
      onTabSelect: () => {}, onThemeToggle: () => {}, onLogout: () => {},
    });
    assert.equal(header.querySelector(".ac-fichar-pill"), null);
    assert.equal(header.querySelector(".ac-fichar-fab"), null);
  });
}
