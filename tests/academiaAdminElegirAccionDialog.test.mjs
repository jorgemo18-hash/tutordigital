import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run({ test, assert }) {
  const { elegirAccion } = await import("../assets/academia/admin/js/sections/envioFamilias/elegirAccionDialog.js");

  test("pinta el título y las opciones en orden, con la primera como opción por defecto (foco)", async () => {
    const promesa = elegirAccion({
      titulo: "¿Qué quieres regenerar?",
      opciones: [{ tipo: "a", label: "Opción A" }, { tipo: "b", label: "Opción B" }],
    });
    await esperar(10);
    const overlay = document.querySelector(".ac-modal-overlay");
    assert.ok(overlay);
    assert.equal(overlay.querySelector(".ac-modal-titulo").textContent, "¿Qué quieres regenerar?");

    const labels = [...overlay.querySelectorAll("button")].map((b) => b.textContent);
    assert.deepEqual(labels, ["Opción A", "Opción B", "Cancelar"]);

    const defecto = [...overlay.querySelectorAll("button")].find((b) => b.textContent === "Opción A");
    assert.equal(document.activeElement, defecto);

    defecto.dispatchEvent(new window.Event("click"));
    assert.deepEqual(await promesa, { tipo: "a", label: "Opción A" });
    assert.equal(document.querySelector(".ac-modal-overlay"), null);
  });

  test("devuelve la opción completa elegida (no solo la etiqueta) — incluida una opción 'por alumno' con datos extra", async () => {
    const opcionAlumno = { tipo: "informe_alumno", alumnoId: "a1", alumnoNombre: "Ana", label: "Enviar informe de Ana" };
    const promesa = elegirAccion({ titulo: "¿Qué quieres enviar?", opciones: [{ tipo: "completo", label: "Completo" }, opcionAlumno] });
    await esperar(10);
    const btn = [...document.querySelectorAll(".ac-modal-overlay button")].find((b) => b.textContent === "Enviar informe de Ana");
    btn.dispatchEvent(new window.Event("click"));
    assert.deepEqual(await promesa, opcionAlumno);
  });

  test("Cancelar / Escape / clic fuera -> resuelve null", async () => {
    let promesa = elegirAccion({ titulo: "T", opciones: [{ tipo: "a", label: "A" }] });
    await esperar(10);
    document.querySelector(".ac-modal-overlay").dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);

    promesa = elegirAccion({ titulo: "T", opciones: [{ tipo: "a", label: "A" }] });
    await esperar(10);
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    assert.equal(await promesa, null);
  });
}
