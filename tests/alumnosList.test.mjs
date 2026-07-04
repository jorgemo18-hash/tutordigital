import { Window } from "happy-dom";

// Entorno DOM (happy-dom) montado antes de importar el módulo real, mismo
// patrón que math.test.mjs (que parchea globalThis.document con un stub
// antes de su import) — aquí con un Document real en vez de un stub mínimo,
// porque alumnosList.js sí necesita un DOM funcional (querySelectorAll,
// dispatchEvent, addEventListener) para poder simular clicks de usuario.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

const NOOP = () => {};

function nuevoContainer() {
  return document.createElement("div");
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// happy-dom exige instancias de SU PROPIA clase Event (window.Event) — un
// `new Event(...)` nativo de Node falla con "parameter 1 is not of type
// Event" (comprobado antes de escribir este archivo). El prompt original
// pedía `new Event('click')`; se ajusta a `new window.Event('click')`.
function click(el) {
  el.dispatchEvent(new window.Event("click"));
}

function buscarBotonPorTexto(container, selector, texto) {
  return [...container.querySelectorAll(selector)].find((el) => el.textContent === texto);
}

export async function run({ test, assert }) {
  const { renderAlumnos } = await import("../assets/academia/admin/js/alumnosList.js");

  test("alumnosList: render básico monta contenido en el container", async () => {
    const fetchAlumnosPaginaFn = async () => ({ alumnos: [], total: 0 });
    const fetchPendientesFn = async () => 0;
    const container = nuevoContainer();

    await renderAlumnos(container, {
      onAbrirAlumno: NOOP,
      onNuevoAlumno: NOOP,
      fetchAlumnosPaginaFn,
      fetchPendientesFn,
    });

    assert.ok(container.children.length > 0, "el container debería tener al menos un hijo tras renderAlumnos");
  });

  test("alumnosList: cambio de pestaña descarta la carga vieja que resuelve tarde", async () => {
    // Llamada 0 (pestaña "Activos" inicial): lenta, 200ms — simula la
    // latencia variable vista hoy en el backend real.
    // Llamada 1 (tras el click en la 2ª pestaña, "Archivados"): resuelve
    // ya mismo. Si cargaId no descartara la llamada 0 al resolver más
    // tarde, su renderLista() pisaría el resultado correcto de la 1.
    let llamada = 0;
    const fetchAlumnosPaginaFn = () => {
      const miLlamada = llamada++;
      if (miLlamada === 0) {
        return new Promise((resolve) =>
          setTimeout(() => resolve({ alumnos: [{ id: "1", nombre: "Lento", nivel: "A1", estado: "activo" }], total: 1 }), 200)
        );
      }
      return Promise.resolve({ alumnos: [{ id: "2", nombre: "Rapido", nivel: "A1", estado: "activo" }], total: 1 });
    };
    const fetchPendientesFn = async () => 0;
    const container = nuevoContainer();

    // Sin await: renderAlumnos corre síncrono hasta su primer await interno
    // (dentro de cargar(), al llamar a fetchAlumnosPaginaFn) — para cuando
    // esta línea termina, las pestañas YA están en el DOM (se añaden antes
    // del await Promise.all(...) final de renderAlumnos).
    const renderPromise = renderAlumnos(container, {
      onAbrirAlumno: NOOP,
      onNuevoAlumno: NOOP,
      fetchAlumnosPaginaFn,
      fetchPendientesFn,
    });

    const tabs = container.querySelectorAll(".ac-list-tab");
    assert.equal(tabs.length, 3, "deberían existir las 3 pestañas (Activos/Archivados/Pendientes)");
    click(tabs[1]); // "Archivados" — dispara la 2ª carga (rápida) antes de que resuelva la 1ª (lenta)

    await renderPromise;
    await esperar(500); // margen generoso para que la llamada lenta también resuelva

    assert.ok(!container.textContent.includes("Lento"), "no debe quedar visible el resultado descartado de la carga vieja");
    assert.ok(container.textContent.includes("Rapido"), "debe quedar visible el resultado de la carga más reciente");
  });

  test("alumnosList: cambio de página (Siguiente) descarta la carga vieja que resuelve tarde", async () => {
    // Llamada 0 (carga inicial, página 1): inmediata, total:60 para que
    // pageSize=30 deje al menos una página más (botón "Siguiente" activo).
    // Llamada 1 (1er click en "Siguiente"): lenta, 300ms.
    // Llamada 2 (2º click en "Siguiente", disparado ANTES de que la 1
    // resuelva): inmediata — debe ganar aunque la 1 resuelva después.
    //
    // Nota: el botón "Siguiente" desaparece del DOM en cuanto se pincha
    // (cargar() reemplaza listEl por "Cargando…" de inmediato) y no vuelve
    // a existir hasta que esa carga resuelve — así que el 2º click no
    // puede hacerse sobre un botón "recién renderizado" (no existe
    // ninguno mientras la llamada 1 está en vuelo). Se reutiliza la MISMA
    // referencia del botón ya pinchado: su cierre (`page + 1` capturado en
    // buildPaginacion en el momento de crearlo, con page=1) sigue siendo
    // válido y dispara onCambiarPagina(2) de nuevo — mecánicamente ambos
    // clicks apuntan a la página 2, pero eso es irrelevante para lo que se
    // valida aquí: que la llamada 2 (más reciente) gane sobre la 1 (más
    // vieja) aunque la 1 resuelva más tarde.
    let llamada = 0;
    const fetchAlumnosPaginaFn = () => {
      const miLlamada = llamada++;
      if (miLlamada === 0) {
        return Promise.resolve({ alumnos: [{ id: "1", nombre: "PaginaUno", nivel: "A1", estado: "activo" }], total: 60 });
      }
      if (miLlamada === 1) {
        return new Promise((resolve) =>
          setTimeout(() => resolve({ alumnos: [{ id: "2", nombre: "PaginaDosLenta", nivel: "A1", estado: "activo" }], total: 60 }), 300)
        );
      }
      return Promise.resolve({ alumnos: [{ id: "3", nombre: "PaginaDosRapida", nivel: "A1", estado: "activo" }], total: 60 });
    };
    const fetchPendientesFn = async () => 0;
    const container = nuevoContainer();

    await renderAlumnos(container, {
      onAbrirAlumno: NOOP,
      onNuevoAlumno: NOOP,
      fetchAlumnosPaginaFn,
      fetchPendientesFn,
    });

    const siguienteBtn = buscarBotonPorTexto(container, ".ac-btn.ghost.sm", "Siguiente");
    assert.ok(siguienteBtn, 'el botón "Siguiente" debería existir con total=60 y pageSize=30');

    click(siguienteBtn); // dispara la llamada 1 (lenta)
    click(siguienteBtn); // dispara la llamada 2 (rápida), antes de que la 1 resuelva

    await esperar(500);

    assert.ok(!container.textContent.includes("PaginaDosLenta"), "no debe quedar visible el resultado descartado de la carga vieja");
    assert.ok(container.textContent.includes("PaginaDosRapida"), "debe quedar visible el resultado de la carga más reciente");
  });
}
