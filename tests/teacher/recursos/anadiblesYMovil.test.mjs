import { Window } from "happy-dom";

// Qué se puede añadir (anadibles.js) y la pestaña Recursos del panel móvil
// (mobile/mobileTeacherRecursos.js).
export async function run({ test, assert }) {
  const { bateriasAnadibles, claveAlAzar } = await import("../../../assets/teacher/js/recursos/anadibles.js");

  const TEMA = { objetivos: [
    { numero: 1, titulo: "Uno", baterias: [{ clave: "a" }, { clave: "b" }] },
    { numero: 2, titulo: "Dos", baterias: [{ clave: "c" }] },
    { numero: 3, titulo: "Tres", baterias: [{ clave: "d" }] },
  ] };

  test("se puede añadir del objetivo y de sus anteriores, del más alto al más bajo, con su título", () => {
    const l = bateriasAnadibles(TEMA, 2);
    assert.deepEqual(l.map((b) => b.clave), ["c", "a", "b"]);
    assert.equal(l[0].tituloObjetivo, "Dos");
  });

  test("al azar, primero un tipo que no esté en la hoja; si están todos, cualquiera", () => {
    const candidatas = [{ clave: "a" }, { clave: "b" }];
    assert.equal(claveAlAzar({ huecos: [{ clave: "a" }], candidatas, azar: () => 0.99 }), "b");
    assert.equal(claveAlAzar({ huecos: [{ clave: "a" }, { clave: "b" }], candidatas, azar: () => 0 }), "a");
    assert.equal(claveAlAzar({ huecos: [], candidatas: [], azar: () => 0 }), undefined);
  });

  test("PANEL MÓVIL: la pestaña Recursos monta la pantalla en modo móvil una sola vez, con la asignatura elegida", async () => {
    const win = new Window();
    const prev = { window: globalThis.window, document: globalThis.document };
    globalThis.window = win;
    globalThis.document = win.document;
    try {
      const { initMtRecursos } = await import("../../../assets/teacher/mobile/mobileTeacherRecursos.js");
      const pageEl = win.document.createElement("div");
      const headerEl = win.document.createElement("div");
      const mtState = { currentSubjectName: "Música" };
      const creadas = [];
      let revisada = 0;
      const r = initMtRecursos({
        pageEl, headerEl, mtState, centro: "IES",
        crearPantallaFn: (op) => { creadas.push(op); return { render() {}, revisarAsignatura() { revisada += 1; } }; },
      });
      assert.ok(headerEl.textContent.includes("Hojas de"));
      assert.ok(pageEl.querySelector(".rc.rc--movil"));
      r.alMostrar();
      r.alMostrar();
      assert.equal(creadas.length, 1);
      assert.equal(creadas[0].movil, true);
      assert.equal(creadas[0].centro, "IES");
      assert.equal(creadas[0].getAsignatura(), "Música");
      assert.equal(revisada, 1, "al volver a la pestaña se revisa la asignatura");
    } finally {
      globalThis.window = prev.window;
      globalThis.document = prev.document;
    }
  });
}
