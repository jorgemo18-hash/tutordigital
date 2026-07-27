import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// snapshotFormValues() — adaptador genérico de getSnapshot() para el caso
// común de un drawer con inputs/textareas/selects reales en el DOM.
export async function run({ test, assert }) {
  const { snapshotFormValues } = await import("../../../assets/shared/js/unsavedChanges/snapshotFormValues.js");

  test("sin rootEl -> array vacío, no revienta", () => {
    assert.deepEqual(snapshotFormValues(null), []);
  });

  test("lee inputs de texto por name/id", () => {
    const root = document.createElement("div");
    root.innerHTML = `<input name="nombre" value="Ana" /><textarea id="nota">Hola</textarea>`;
    const snap = snapshotFormValues(root);
    assert.deepEqual(snap, [["nombre", "Ana"], ["nota", "Hola"]]);
  });

  test("checkboxes/radios se comparan por .checked, no por .value", () => {
    const root = document.createElement("div");
    root.innerHTML = `<input type="checkbox" name="activo" checked />`;
    assert.deepEqual(snapshotFormValues(root), [["activo", true]]);
  });

  test("sin name/id, usa data-student-id si existe", () => {
    const root = document.createElement("div");
    root.innerHTML = `<input data-student-id="s1" value="7" />`;
    assert.deepEqual(snapshotFormValues(root), [["s1", "7"]]);
  });

  test("sin ninguna clave -> índice de respaldo (para que añadir un campo también cuente como cambio)", () => {
    const root = document.createElement("div");
    root.innerHTML = `<input value="a" /><input value="b" />`;
    assert.deepEqual(snapshotFormValues(root), [["campo-0", "a"], ["campo-1", "b"]]);
  });

  test("añadir un campo nuevo cambia el snapshot aunque los demás valores sigan igual", () => {
    const root = document.createElement("div");
    root.innerHTML = `<input name="a" value="1" />`;
    const antes = JSON.stringify(snapshotFormValues(root));
    const nuevo = document.createElement("input");
    nuevo.name = "b";
    nuevo.value = "2";
    root.appendChild(nuevo);
    const despues = JSON.stringify(snapshotFormValues(root));
    assert.notEqual(antes, despues);
  });
}
