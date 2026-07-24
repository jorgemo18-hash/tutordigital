import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

export async function run({ test, assert }) {
  const { buildTablaFichajes } = await import("../assets/academia/admin/js/sections/fichajes/tablaFichajes.js");

  test("sin fichajes muestra un mensaje vacío, no una tabla", async () => {
    const wrap = buildTablaFichajes([], { onCorregir: () => {} });
    assert.equal(wrap.querySelector("table"), null);
    assert.ok(wrap.textContent.includes("Sin fichajes"));
  });

  test("original y corrección se pintan como DOS filas separadas, nunca fusionadas", async () => {
    const fichajes = [
      { id: "f1", tipo: "entrada", origen: "worker", timestamp: "2026-07-05T08:00:00.000Z" },
      {
        id: "f2", tipo: "salida", origen: "admin_correccion", timestamp: "2026-07-05T17:00:00.000Z",
        motivo: "Se le olvidó fichar", corregidoPorNombre: "María Admin",
      },
    ];
    const wrap = buildTablaFichajes(fichajes, { onCorregir: () => {} });
    const filas = wrap.querySelectorAll("tbody tr");
    assert.equal(filas.length, 2, "cada fichaje debe ser su propia fila");

    const filaCorreccion = wrap.querySelector(".ac-fila-correccion");
    assert.ok(filaCorreccion, "la fila de corrección debe llevar la clase de resaltado");
    assert.ok(filaCorreccion.textContent.includes("Se le olvidó fichar"));
    assert.ok(filaCorreccion.textContent.includes("María Admin"));

    const badgeCorreccion = wrap.querySelector(".ac-fila-correccion .ac-estado-badge");
    assert.ok(badgeCorreccion.classList.contains("amber"));

    const filaOriginal = [...filas].find((tr) => !tr.classList.contains("ac-fila-correccion"));
    assert.ok(filaOriginal.textContent.includes("Fichado por el trabajador"));
  });

  test("las notas opcionales de una corrección se muestran junto al motivo", async () => {
    const fichajes = [
      {
        id: "f2", tipo: "salida", origen: "admin_correccion", timestamp: "2026-07-05T17:00:00.000Z",
        motivo: "Se le olvidó fichar", notas: "Confirmado con el compañero de guardia.", corregidoPorNombre: "María Admin",
      },
    ];
    const wrap = buildTablaFichajes(fichajes, { onCorregir: () => {} });
    assert.ok(wrap.textContent.includes("Confirmado con el compañero de guardia."));
  });

  test("sin notas, la fila no muestra nada de más (no aparece 'null' ni 'undefined')", async () => {
    const fichajes = [
      {
        id: "f2", tipo: "salida", origen: "admin_correccion", timestamp: "2026-07-05T17:00:00.000Z",
        motivo: "Se le olvidó fichar", notas: null, corregidoPorNombre: "María Admin",
      },
    ];
    const wrap = buildTablaFichajes(fichajes, { onCorregir: () => {} });
    assert.equal(wrap.textContent.includes("null"), false);
    assert.equal(wrap.textContent.includes("undefined"), false);
  });

  test("el botón 'Corregir' de una fila llama a onCorregir con ese fichaje", async () => {
    const fichaje = { id: "f1", tipo: "entrada", origen: "worker", timestamp: "2026-07-05T08:00:00.000Z" };
    let recibido = null;
    const wrap = buildTablaFichajes([fichaje], { onCorregir: (f) => { recibido = f; } });
    const btn = wrap.querySelector("button");
    btn.dispatchEvent(new window.Event("click"));
    assert.equal(recibido.id, "f1");
  });
}
