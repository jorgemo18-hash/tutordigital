import { Window } from "happy-dom";

// AGENDA · CUADERNO · RECURSOS, una cada vez (js/navegacion/vistasDelPanel.js),
// y que la plantilla del panel trae la barra y las tres zonas.
export async function run({ test, assert }) {
  const { montarVistasDelPanel, vistaDeLaDireccion, VISTAS } = await import("../../../assets/teacher/js/navegacion/vistasDelPanel.js");
  const { getDashboardTemplate } = await import("../../../assets/teacher/js/templates.js");

  function panel(hash = "") {
    const win = new Window({ url: `https://x.test/assets/teacher/${hash}` });
    win.document.body.innerHTML = getDashboardTemplate();
    return win;
  }
  const visibles = (win) => [...win.document.querySelectorAll("[data-vista-de]")].filter((s) => !s.hidden).map((s) => s.dataset.vistaDe);

  test("la plantilla trae la barra con las tres vistas y una zona para cada una", () => {
    const win = panel();
    const botones = [...win.document.querySelectorAll(".tn-nav [data-vista]")].map((b) => b.dataset.vista);
    assert.deepEqual(botones, VISTAS);
    for (const v of VISTAS) assert.ok(win.document.querySelector(`[data-vista-de="${v}"]`), `falta la zona ${v}`);
  });

  test("al entrar se ve SOLO la Agenda", () => {
    const win = panel();
    const vistas = [];
    montarVistasDelPanel({ raiz: win.document.body, win, onCambio: (v) => vistas.push(v) });
    assert.deepEqual(visibles(win), ["agenda"]);
    assert.deepEqual(vistas, ["agenda"]);
    assert.equal(win.document.querySelector('[data-vista="agenda"]').getAttribute("aria-current"), "page");
  });

  test("pulsar Recursos esconde Agenda y Cuaderno, lo apunta en la dirección y avisa una vez", () => {
    const win = panel();
    const vistas = [];
    montarVistasDelPanel({ raiz: win.document.body, win, onCambio: (v) => vistas.push(v) });
    win.document.querySelector('[data-vista="recursos"]').click();
    win.document.querySelector('[data-vista="recursos"]').click();
    assert.deepEqual(visibles(win), ["recursos"]);
    assert.equal(win.location.hash, "#recursos");
    assert.deepEqual(vistas, ["agenda", "recursos"]);
    assert.equal(win.document.querySelector('[data-vista="agenda"]').getAttribute("aria-current"), null);
  });

  test("al recargar con #cuaderno se vuelve al Cuaderno; una dirección rara lleva a la Agenda", () => {
    const win = panel("#cuaderno");
    montarVistasDelPanel({ raiz: win.document.body, win });
    assert.deepEqual(visibles(win), ["cuaderno"]);
    assert.equal(vistaDeLaDireccion("#lo-que-sea"), "agenda");
    assert.equal(vistaDeLaDireccion(""), "agenda");
  });
}
