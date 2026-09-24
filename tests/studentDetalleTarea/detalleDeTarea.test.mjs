import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// El alumno ve lo que el profesor escribió en la tarea.
//
// EL PROBLEMA: la descripción de la tarea llegaba al tutor pero no al alumno.
// En el ordenador #ctxTaskDesc no se rellenaba nunca; en el móvil el título
// lleva una flecha ⌄ y tocarlo no hacía nada.
export async function run({ test, assert }) {
  const { detalleDeTarea } = await import("../../assets/student/features/agenda/detalleDeTarea.js");
  const { pintarDetalleDeTarea } = await import("../../assets/student/controllers/mobileTutor/pintarDetalleDeTarea.js");

  const TAREA = {
    id: "t1", title: "Ecuaciones", desc: "  Haz del 3 al 7.\nEl 8 es voluntario. ", teacher_notes: "Ojo con los signos",
    dueDate: "2026-10-02", attachments: [{ id: "a1", file_name: "ficha.pdf" }, { id: "a2", file_name: "" }],
  };

  test("detalleDeTarea: recoge descripción, notas, entrega y archivos", () => {
    const d = detalleDeTarea(TAREA);
    assert.equal(d.titulo, "Ecuaciones");
    assert.equal(d.descripcion, "Haz del 3 al 7.\nEl 8 es voluntario.");
    assert.equal(d.notas, "Ojo con los signos");
    assert.equal(d.entrega, "02/10/2026");
    assert.deepEqual(d.adjuntos, [{ id: "a1", nombre: "ficha.pdf" }, { id: "a2", nombre: "Archivo" }]);
  });

  test("detalleDeTarea: acepta los nombres del servidor (description, due_date) y los del contexto (teacherNotes)", () => {
    const d = detalleDeTarea({ title: "X", description: "Leer", due_date: "2026-09-30T00:00:00Z", teacherNotes: "n" });
    assert.equal(d.descripcion, "Leer");
    assert.equal(d.entrega, "30/09/2026");
    assert.equal(d.notas, "n");
    assert.deepEqual(d.adjuntos, []);
  });

  test("detalleDeTarea: sin tarea, nada", () => {
    assert.equal(detalleDeTarea(null), null);
  });

  test("detalleDeTarea: pinta la descripción como texto, no como HTML", () => {
    const cont = document.createElement("div");
    pintarDetalleDeTarea(cont, detalleDeTarea({ title: "T", desc: "<img src=x onerror=alert(1)>" }), { doc: document });
    assert.equal(cont.querySelector("img"), null);
    assert.ok(cont.textContent.includes("<img src=x onerror=alert(1)>"));
  });

  test("detalleDeTarea: sin descripción lo dice, en vez de dejar un hueco", () => {
    const cont = document.createElement("div");
    pintarDetalleDeTarea(cont, detalleDeTarea({ title: "T" }), { doc: document });
    assert.ok(cont.textContent.includes("El profesor no ha escrito descripción."));
  });

  test("detalleDeTarea: cada archivo abre el suyo", () => {
    const cont = document.createElement("div");
    const abiertos = [];
    pintarDetalleDeTarea(cont, detalleDeTarea(TAREA), { doc: document, alAbrirAdjunto: (id) => abiertos.push(id) });
    const botones = cont.querySelectorAll(".mtd-adjunto");
    assert.equal(botones.length, 2);
    botones[1].click();
    assert.deepEqual(abiertos, ["a2"]);
  });

  test("detalleDeTarea: vuelve a pintarse limpio al abrir otra tarea", () => {
    const cont = document.createElement("div");
    pintarDetalleDeTarea(cont, detalleDeTarea(TAREA), { doc: document });
    pintarDetalleDeTarea(cont, detalleDeTarea({ title: "Otra" }), { doc: document });
    assert.ok(!cont.textContent.includes("Ecuaciones"));
    assert.equal(cont.querySelectorAll(".mtd-titulo").length, 1);
  });
}
