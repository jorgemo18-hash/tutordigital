export async function run({ test, assert }) {
  const { calcularEstadoFichajeFab, HORAS_AVISO_SALIDA } = await import("../../assets/shared/js/fichaje/ficharFabEstado.js");

  test("HORAS_AVISO_SALIDA es 8 (menor que las 12h del auto-cierre de seguridad, no implementado aquí)", () => {
    assert.equal(HORAS_AVISO_SALIDA, 8);
  });

  test("no ha fichado entrada hoy -> pendiente, acción 'entrada'", () => {
    const estado = calcularEstadoFichajeFab({ dentro: false, haFichadoEntradaHoy: false, ultimoTimestamp: null });
    assert.deepEqual(estado, { dentro: false, pendiente: true, siguienteTipo: "entrada", etiquetaAccion: "Fichar entrada" });
  });

  test("dentro desde hace menos del umbral -> en regla (compacto), acción 'salida'", () => {
    const ahoraMs = Date.parse("2026-07-25T14:00:00Z");
    const ultimoTimestamp = "2026-07-25T09:00:00Z"; // 5h dentro
    const estado = calcularEstadoFichajeFab(
      { dentro: true, haFichadoEntradaHoy: true, ultimoTimestamp },
      { ahoraMs },
    );
    assert.equal(estado.dentro, true);
    assert.equal(estado.pendiente, false);
    assert.equal(estado.siguienteTipo, "salida");
    assert.equal(estado.etiquetaAccion, "Fichar salida");
  });

  test("dentro desde exactamente el umbral de horas -> pasa a pendiente", () => {
    const ultimoTimestamp = "2026-07-25T09:00:00Z";
    const ahoraMs = Date.parse("2026-07-25T17:00:00Z"); // exactamente 8h
    const estado = calcularEstadoFichajeFab(
      { dentro: true, haFichadoEntradaHoy: true, ultimoTimestamp },
      { ahoraMs },
    );
    assert.equal(estado.pendiente, true);
    assert.equal(estado.siguienteTipo, "salida");
  });

  test("dentro más del umbral -> pendiente, acción 'salida'", () => {
    const ultimoTimestamp = "2026-07-25T09:00:00Z";
    const ahoraMs = Date.parse("2026-07-25T18:30:00Z"); // 9.5h
    const estado = calcularEstadoFichajeFab(
      { dentro: true, haFichadoEntradaHoy: true, ultimoTimestamp },
      { ahoraMs },
    );
    assert.equal(estado.pendiente, true);
  });

  test("umbral configurable vía horasAvisoSalida", () => {
    const ultimoTimestamp = "2026-07-25T09:00:00Z";
    const ahoraMs = Date.parse("2026-07-25T11:30:00Z"); // 2.5h
    const estado = calcularEstadoFichajeFab(
      { dentro: true, haFichadoEntradaHoy: true, ultimoTimestamp },
      { ahoraMs, horasAvisoSalida: 2 },
    );
    assert.equal(estado.pendiente, true, "con un umbral de 2h, a las 2.5h ya debe estar pendiente");
  });

  test("ya fichó entrada y salida hoy (p.ej. una pausa) -> en regla, acción 'entrada' por si retoma", () => {
    const estado = calcularEstadoFichajeFab({ dentro: false, haFichadoEntradaHoy: true, ultimoTimestamp: "2026-07-25T09:00:00Z" });
    assert.deepEqual(estado, { dentro: false, pendiente: false, siguienteTipo: "entrada", etiquetaAccion: "Fichar entrada" });
  });

  test("dentro sin ultimoTimestamp (dato inesperado) -> no revienta, no queda pendiente por defecto", () => {
    const estado = calcularEstadoFichajeFab({ dentro: true, haFichadoEntradaHoy: true, ultimoTimestamp: null });
    assert.equal(estado.pendiente, false);
  });
}
