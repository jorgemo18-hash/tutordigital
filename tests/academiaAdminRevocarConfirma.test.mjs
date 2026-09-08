import fs from "node:fs";

// Revocar la invitación de un profesor era la ÚNICA acción destructiva del
// panel sin confirmación (auditoría del 08/09/2026): un clic invalidaba el
// enlace que el profesor tiene en su correo, sin preguntar, sin poder
// deshacerse y sin decir qué se perdía. Archivar un alumno, eliminarlo,
// borrar un gasto o revocar una sustitución sí preguntaban todas.
//
// Es un test estructural: lo que hay que garantizar es el ORDEN —preguntar
// antes de romper el enlace— y que el mensaje informe. Montar la sección
// entera para llegar hasta el botón traería media docena de módulos de red
// sin añadir nada a lo que se quiere demostrar.
export async function run({ test, assert }) {
  const RUTA = new URL("../assets/academia/admin/js/sections/profesoresSection.js", import.meta.url);
  const src = fs.readFileSync(RUTA, "utf8");

  test("REGRESIÓN: revocar pregunta antes, y si dicen que no, no se revoca", () => {
    assert.match(src, /if \(!confirmFn\([\s\S]{0,200}\)\) return;/,
      "sin este return, el 'cancelar' del diálogo no cancelaría nada");

    const iConfirm = src.indexOf("if (!confirmFn(");
    const iRevocar = src.indexOf("await revocarInvitacionProfesor(");
    assert.ok(iConfirm > 0, "hay confirmación");
    assert.ok(iRevocar > 0, "hay llamada de revocar");
    assert.ok(iConfirm < iRevocar, "preguntar ANTES de romper el enlace, no después");
  });

  test("el mensaje dice qué se anula y qué habrá que hacer", () => {
    // "¿Seguro?" no informa de nada. El profesor tiene ese enlace en su
    // correo y deja de valer: hay que decirlo.
    assert.match(src, /enlace de invitación/i);
    assert.match(src, /volver a invitar/i);
  });

  test("confirmFn es inyectable, como en el resto de acciones destructivas", () => {
    // Mismo criterio que sustitucionesSection.js y regenerarBoton.js: por
    // defecto window.confirm, sustituible en tests.
    assert.match(src, /confirmFn = \(mensaje\) => window\.confirm\(mensaje\)/);
  });
}
