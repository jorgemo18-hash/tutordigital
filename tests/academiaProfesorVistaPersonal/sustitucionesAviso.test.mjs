import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// buildAvisoSustituciones() es el aviso compartido por Horario y Diario
// (sustituciones pasó a ser gestión exclusiva del admin — ver commit de
// este cambio): solo cuenta "soy_sustituto", nunca "me cubren", porque
// que a este profesor lo cubran no cambia nada de lo que él ve.
export async function run({ test, assert }) {
  const { buildAvisoSustituciones } = await import("../../assets/academia/profesor/js/sustitucionesAviso.js");

  test("sin sustituciones -> null (no hay nada que avisar)", () => {
    assert.equal(buildAvisoSustituciones([]), null);
    assert.equal(buildAvisoSustituciones(null), null);
    assert.equal(buildAvisoSustituciones(undefined), null);
  });

  test("solo 'me cubren' (soy_sustituto: false) -> null, no avisa de eso", () => {
    const aviso = buildAvisoSustituciones([{ soy_sustituto: false, sustituto_nombre: "Carlos" }]);
    assert.equal(aviso, null);
  });

  test("cubriendo a un profesor -> aviso con su nombre", () => {
    const aviso = buildAvisoSustituciones([{ soy_sustituto: true, sustituido_nombre: "Bea" }]);
    assert.ok(aviso);
    assert.equal(aviso.className, "ac-nota");
    assert.equal(aviso.textContent, "Hoy cubres a Bea — sus alumnos aparecen aquí.");
  });

  test("cubriendo a VARIOS profesores el mismo día -> los lista todos, no solo el primero", () => {
    const aviso = buildAvisoSustituciones([
      { soy_sustituto: true, sustituido_nombre: "Bea" },
      { soy_sustituto: true, sustituido_nombre: "Carlos" },
      { soy_sustituto: false, sustituto_nombre: "Dani" }, // no debe colarse
    ]);
    assert.equal(aviso.textContent, "Hoy cubres a Bea, Carlos — sus alumnos aparecen aquí.");
  });

  test("sustituido sin nombre resuelto -> texto de respaldo, no revienta", () => {
    const aviso = buildAvisoSustituciones([{ soy_sustituto: true, sustituido_nombre: null }]);
    assert.equal(aviso.textContent, "Hoy cubres a un profesor — sus alumnos aparecen aquí.");
  });
}
