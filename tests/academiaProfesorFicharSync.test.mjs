import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Regresión: banner superior y widget de cabecera son dos componentes
// independientes que pueden fichar la misma entrada/salida (el banner
// solo cubre entrada; la salida solo se puede fichar desde el widget).
// Sin wiring entre ambos (ver onFichado/refrescar en ficharBanner.js y
// ficharHeaderWidget.js, y su conexión en academiaProfesor.js), fichar
// desde uno dejaba al otro con el estado obtenido al cargar la pantalla,
// ya obsoleto — el widget se quedaba en "Fuera" tras fichar entrada
// desde el banner, y no había ninguna forma de fichar salida.
export async function run({ test, assert }) {
  const { createFicharBanner } = await import("../assets/academia/profesor/js/banner/ficharBanner.js");
  const { buildFicharHeaderWidget } = await import("../assets/academia/profesor/js/header/ficharHeaderWidget.js");

  // Simula el backend real: un único estado compartido que ambos
  // componentes leen y modifican, igual que harían dos llamadas reales
  // a /academia/fichajes/mi-estado y /academia/fichajes/fichar.
  function crearServidorFake() {
    let dentro = false;
    let haFichadoEntradaHoy = false;
    return {
      fetchMiEstadoFichajeFn: async () => ({ dentro, haFichadoEntradaHoy }),
      ficharFnDep: async (tipo) => {
        dentro = tipo === "entrada";
        if (tipo === "entrada") haFichadoEntradaHoy = true;
      },
    };
  }

  // Wiring idéntico al de academiaProfesor.js: cada uno avisa al otro
  // tras fichar con éxito.
  function montarPantalla(servidor) {
    let banner = null;
    const widget = buildFicharHeaderWidget({ ...servidor, onFichado: () => banner?.refresh() });
    banner = createFicharBanner({ ...servidor, confirmacionMs: 5, onFichado: () => widget.refrescar() });
    return { banner, widget };
  }

  test("ciclo completo: fichar entrada en el banner -> el widget pasa a 'Dentro' sin recargar -> fichar salida en el widget -> vuelve a 'Fuera'", async () => {
    const servidor = crearServidorFake();
    const { banner, widget } = montarPantalla(servidor);
    await esperar(10);

    assert.equal(widget.el.querySelector("span:last-child").textContent, "Fuera", "estado inicial: nadie ha fichado");
    assert.equal(banner.el.classList.contains("hidden"), false, "banner visible: aún no fichó entrada hoy");

    banner.el.querySelector("button").dispatchEvent(new window.Event("click"));
    await esperar(10);

    assert.equal(widget.el.querySelector("span:last-child").textContent, "Dentro", "el widget debe reflejar el fichaje hecho desde el banner, sin recargar la página");

    await esperar(10); // deja pasar confirmacionMs para que el banner se oculte
    assert.ok(banner.el.classList.contains("hidden"), "tras fichar entrada, el banner se oculta (ya cumplió su propósito)");

    // La salida solo se puede fichar desde el widget — sin el fix, se
    // quedaba "atascado" en Fuera y un clic aquí volvía a intentar
    // fichar ENTRADA (que el backend real rechazaría).
    widget.el.dispatchEvent(new window.Event("click"));
    await esperar(10);

    assert.equal(widget.el.querySelector("span:last-child").textContent, "Fuera", "fichar salida desde el widget debe funcionar y reflejarse de inmediato");
  });

  test("fichar salida desde el widget también refresca el banner (que sigue oculto: ya fichó entrada hoy)", async () => {
    const servidor = crearServidorFake();
    let refrescos = 0;
    const { banner, widget } = montarPantalla(servidor);
    const refreshOriginal = banner.refresh;
    banner.refresh = (...args) => { refrescos++; return refreshOriginal(...args); };
    await esperar(10);

    banner.el.querySelector("button").dispatchEvent(new window.Event("click"));
    await esperar(15);

    widget.el.dispatchEvent(new window.Event("click")); // fichar salida
    await esperar(10);

    assert.ok(refrescos >= 1, "el banner debe recibir el aviso de refresco tras el fichaje del widget");
    assert.ok(banner.el.classList.contains("hidden"), "el banner permanece oculto: ya fichó entrada hoy, fichar salida no lo reactiva");
  });
}
