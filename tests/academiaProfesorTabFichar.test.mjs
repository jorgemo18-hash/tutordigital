import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// "Fichar" dejó de ser una tab (ver ficharHeaderWidget.js): Horario/Diario
// son las únicas tabs, siempre en ese orden, y Horario es la de por
// defecto. El acceso rápido de fichar vive en la cabecera (ac-h-actions)
// y solo se monta si el tenant activó el control horario.
export async function run({ test, assert }) {
  const { TABS, buildHeader } = await import("../assets/academia/profesor/js/tabsHeader.js");

  test("TABS es siempre Horario y Diario, en ese orden, sin Fichar", () => {
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

  test("con control horario activo, se monta el acceso rápido de fichar en la cabecera", async () => {
    const shell = document.createElement("div");
    const { header } = buildHeader(shell, {
      who: "Ana", academia: "Academia Demo", tabsList: TABS,
      onTabSelect: () => {}, onThemeToggle: () => {}, onLogout: () => {},
      controlHorarioActivo: true,
      ficharWidgetDeps: { fetchMiEstadoFichajeFn: async () => ({ dentro: false }), ficharFnDep: async () => {} },
    });
    assert.ok(header.querySelector(".ac-fichar-pill"));
  });

  test("sin control horario activo, no se monta ningún acceso rápido de fichar", () => {
    const shell = document.createElement("div");
    const { header } = buildHeader(shell, {
      who: "Ana", academia: "Academia Demo", tabsList: TABS,
      onTabSelect: () => {}, onThemeToggle: () => {}, onLogout: () => {},
      controlHorarioActivo: false,
    });
    assert.equal(header.querySelector(".ac-fichar-pill"), null);
  });
}
