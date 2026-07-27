// gradeDrawerScoreError.js — Muestra/oculta el error de validación de una
// nota en grade-drawer.js. Extraído para dejar sitio al guard de "cambios
// sin guardar" sin que grade-drawer.js pase de 400 líneas — recibe los
// elementos como parámetros explícitos en vez de cerrar sobre variables
// del módulo que lo usa.
export function showScoreError(scoreInput, scoreError, message) {
  scoreInput.classList.add("gd-score-input--error");
  scoreError.textContent = message;
  scoreError.style.display = "";
}

export function clearScoreError(scoreInput, scoreError) {
  scoreInput.classList.remove("gd-score-input--error");
  scoreError.textContent = "";
  scoreError.style.display = "none";
}
