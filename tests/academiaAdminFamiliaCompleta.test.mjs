import { Window } from "happy-dom";

// Entorno DOM (happy-dom), mismo patrón que alumnosList.test.mjs.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function textoDe(wrap, selector) {
  return wrap.querySelector(selector)?.textContent || "";
}

export async function run({ test, assert }) {
  const { buildFamiliaCompletaBlock } = await import("../assets/academia/admin/js/drawer/familia/familiaCompleta.js");

  const FAMILIA_ID = "f1";
  // Caso real: Familia García (Lyceo) — ANIBAL_1E (bruto 75, 10% -> neto
  // 67.50) y jose matias (neto 40.50). Total real: 108.00.
  const ANIBAL = { id: "a1", nombre: "ANIBAL_1E", familia: { id: FAMILIA_ID }, tarifa_vigente: { precio_neto: 67.5 } };
  const JOSE = { id: "a2", nombre: "jose matias", familia: { id: FAMILIA_ID }, tarifa_vigente: { precio_neto: 40.5 } };

  test("editar un alumno que ya pertenece a la familia mostrada: no se duplica, total = suma real de la familia (caso real Familia García)", async () => {
    const { wrap } = buildFamiliaCompletaBlock({
      familiaId: FAMILIA_ID,
      alumnoId: "a1", // ANIBAL_1E es quien se está editando — ya está en la lista de miembros
      fetchAlumnosFn: async () => [ANIBAL, JOSE],
      getTarifaActual: () => ({ precio_bruto: 75, descuento_pct: 10 }), // su misma tarifa real
    });
    await esperar(20);

    const filasHermanos = wrap.querySelectorAll(".ac-familia-completa-title ~ div .ac-familia-completa-row");
    assert.equal(filasHermanos.length, 2, "ANIBAL_1E y jose matias, cada uno una sola vez");
    assert.ok(textoDe(wrap, ".ac-familia-completa-title ~ div").includes("ANIBAL_1E"));
    assert.ok(textoDe(wrap, ".ac-familia-completa-title ~ div").includes("jose matias"));

    // La fila "extra" (antes "Tarifa del alumno nuevo") debe quedar oculta —
    // ANIBAL_1E ya está contado en la lista de hermanos, no se le añade otra.
    const filaExtra = wrap.querySelectorAll(".ac-familia-completa-row")[wrap.querySelectorAll(".ac-familia-completa-row").length - 1];
    assert.ok(filaExtra.classList.contains("hidden"), "la fila extra debe quedar oculta cuando el alumno ya es miembro");

    const total = textoDe(wrap, ".ac-familia-completa-total span:last-child");
    assert.equal(total, "108.00 €", "el total no debe contar dos veces a ANIBAL_1E");
  });

  test("crear un alumno nuevo (sin id todavía): sí se añade su fila, con su nombre real — no 'Tarifa del alumno nuevo'", async () => {
    const { wrap } = buildFamiliaCompletaBlock({
      familiaId: FAMILIA_ID,
      alumnoId: null, // todavía no existe
      fetchAlumnosFn: async () => [ANIBAL],
      getTarifaActual: () => ({ precio_bruto: 40.5, descuento_pct: 0 }),
      getNombreActual: () => "Luis Nuevo",
    });
    await esperar(20);

    const filas = wrap.querySelectorAll(".ac-familia-completa-row");
    assert.equal(filas.length, 2, "ANIBAL_1E (ya en la familia) + Luis Nuevo (todavía sin guardar)");
    const filaNueva = filas[filas.length - 1];
    assert.equal(filaNueva.classList.contains("hidden"), false);
    assert.ok(filaNueva.textContent.includes("Luis Nuevo"), "la etiqueta debe ser el nombre real, no 'alumno nuevo'");
    assert.ok(!wrap.textContent.includes("Tarifa del alumno nuevo"));

    const total = textoDe(wrap, ".ac-familia-completa-total span:last-child");
    assert.equal(total, "108.00 €"); // 67.50 (ANIBAL) + 40.50 (Luis Nuevo)
  });

  test("preview de cambio a otra familia (alumno existente, todavía no vinculado en el backend a esta familia): se añade su fila con su nombre real", async () => {
    const { wrap } = buildFamiliaCompletaBlock({
      familiaId: "f2", // familia DESTINO, distinta de la actual del alumno
      alumnoId: "a1", // ANIBAL_1E, pero su familia_id real en el backend sigue siendo f1
      fetchAlumnosFn: async () => [{ id: "a3", nombre: "Otro de f2", familia: { id: "f2" }, tarifa_vigente: { precio_neto: 30 } }],
      getTarifaActual: () => ({ precio_bruto: 75, descuento_pct: 10 }),
      getNombreActual: () => "ANIBAL_1E",
    });
    await esperar(20);

    const filas = wrap.querySelectorAll(".ac-familia-completa-row");
    assert.equal(filas.length, 2);
    const filaAnibal = filas[filas.length - 1];
    assert.equal(filaAnibal.classList.contains("hidden"), false);
    assert.ok(filaAnibal.textContent.includes("ANIBAL_1E"));

    const total = textoDe(wrap, ".ac-familia-completa-total span:last-child");
    assert.equal(total, "97.50 €"); // 30 (Otro de f2) + 67.50 (ANIBAL_1E previsualizado)
  });

  test("cambiar la tarifa después de la carga inicial actualiza en vivo la fila del alumno ya-miembro y el total", async () => {
    let bruto = 75;
    const { wrap, refresh } = buildFamiliaCompletaBlock({
      familiaId: FAMILIA_ID,
      alumnoId: "a1",
      fetchAlumnosFn: async () => [ANIBAL, JOSE],
      getTarifaActual: () => ({ precio_bruto: bruto, descuento_pct: 10 }),
    });
    await esperar(20);
    assert.equal(textoDe(wrap, ".ac-familia-completa-total span:last-child"), "108.00 €");

    bruto = 100; // el admin sube la tarifa de ANIBAL_1E a mitad de edición
    refresh();
    assert.equal(textoDe(wrap, ".ac-familia-completa-total span:last-child"), "130.50 €"); // 90 + 40.50
  });
}
