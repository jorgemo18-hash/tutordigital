import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// "Fichar" es la acción de uso diario más frecuente del profesor: debe ir
// primera (a la izquierda de Horario/Diario, y por tanto ser la pestaña
// por defecto al entrar) y llevar un estilo destacado permanente, no solo
// cuando está activa.
export async function run({ test, assert }) {
  const { TABS_BASE, TAB_FICHAR, buildHeader, computeTabs } = await import("../assets/academia/profesor/js/tabsHeader.js");

  test("con control horario activo, Fichar es la primera tab (y por tanto la de por defecto)", () => {
    const tabs = computeTabs(true);
    assert.equal(tabs[0].id, "fichar");
    assert.deepEqual(tabs.map((t) => t.id), ["fichar", "horario", "diario"]);
  });

  test("sin control horario activo, Fichar no aparece en absoluto", () => {
    const tabs = computeTabs(false);
    assert.deepEqual(tabs.map((t) => t.id), ["horario", "diario"]);
  });

  test("TAB_FICHAR lleva el flag destacado", () => {
    assert.equal(TAB_FICHAR.destacado, true);
  });

  test("ninguna tab base (Horario/Diario) lleva el flag destacado", () => {
    for (const tab of TABS_BASE) assert.equal(Boolean(tab.destacado), false);
  });

  test("el botón de una tab destacada lleva la clase 'ac-tab destacado'", () => {
    const shell = document.createElement("div");
    const { tabButtons } = buildHeader(shell, {
      who: "Ana", academia: "Academia Demo",
      tabsList: [TAB_FICHAR, ...TABS_BASE],
      onTabSelect: () => {}, onThemeToggle: () => {}, onLogout: () => {},
    });
    assert.ok(tabButtons.get("fichar").classList.contains("destacado"));
    assert.equal(tabButtons.get("horario").classList.contains("destacado"), false);
    assert.equal(tabButtons.get("diario").classList.contains("destacado"), false);
  });

  test("marcar una tab como activa no le quita 'destacado' a Fichar, ni al revés", () => {
    const shell = document.createElement("div");
    const { tabButtons } = buildHeader(shell, {
      who: "Ana", academia: "Academia Demo",
      tabsList: [TAB_FICHAR, ...TABS_BASE],
      onTabSelect: () => {}, onThemeToggle: () => {}, onLogout: () => {},
    });
    const ficharBtn = tabButtons.get("fichar");
    const horarioBtn = tabButtons.get("horario");

    horarioBtn.classList.add("active");
    assert.ok(ficharBtn.classList.contains("destacado"), "destacado no depende de cuál esté activa");
    assert.equal(ficharBtn.classList.contains("active"), false);

    ficharBtn.classList.add("active");
    horarioBtn.classList.remove("active");
    assert.ok(ficharBtn.classList.contains("destacado"), "seguir activa no debe quitarle destacado");
    assert.ok(ficharBtn.classList.contains("active"));
  });

  test("clic en un botón de tab llama a onTabSelect con su id", () => {
    const shell = document.createElement("div");
    let seleccionado = null;
    const { tabButtons } = buildHeader(shell, {
      who: "Ana", academia: "Academia Demo",
      tabsList: [TAB_FICHAR, ...TABS_BASE],
      onTabSelect: (id) => { seleccionado = id; }, onThemeToggle: () => {}, onLogout: () => {},
    });
    tabButtons.get("fichar").dispatchEvent(new window.Event("click"));
    assert.equal(seleccionado, "fichar");
  });
}
