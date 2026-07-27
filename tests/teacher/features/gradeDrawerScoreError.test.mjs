import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// showScoreError/clearScoreError — extraídas de grade-drawer.js para
// dejar sitio al guard de "cambios sin guardar" sin pasar de 400 líneas.
export async function run({ test, assert }) {
  const { showScoreError, clearScoreError } = await import("../../../assets/teacher/js/features/gradeDrawerScoreError.js");

  function buildEls() {
    const scoreInput = document.createElement("input");
    const scoreError = document.createElement("p");
    scoreError.style.display = "none";
    return { scoreInput, scoreError };
  }

  test("showScoreError: marca el input y muestra el mensaje", () => {
    const { scoreInput, scoreError } = buildEls();
    showScoreError(scoreInput, scoreError, "Debe estar entre 0 y 10");
    assert.ok(scoreInput.classList.contains("gd-score-input--error"));
    assert.equal(scoreError.textContent, "Debe estar entre 0 y 10");
    assert.equal(scoreError.style.display, "");
  });

  test("clearScoreError: quita la marca y oculta el mensaje", () => {
    const { scoreInput, scoreError } = buildEls();
    showScoreError(scoreInput, scoreError, "error");
    clearScoreError(scoreInput, scoreError);
    assert.equal(scoreInput.classList.contains("gd-score-input--error"), false);
    assert.equal(scoreError.textContent, "");
    assert.equal(scoreError.style.display, "none");
  });
}
