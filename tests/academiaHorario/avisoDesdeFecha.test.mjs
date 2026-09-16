// EL AVISO "desde D/M" Y CUÁNDO DESAPARECE.
//
// Jorge, 16/09/2026: *"en horario también, cuando pase la fecha de comienzo,
// tendría que desaparecer el aviso. Por ejemplo Cristian empieza en octubre,
// en septiembre aparece como ahora, con el aviso debajo, pero cuando llega
// octubre el aviso desaparece porque ya está"*.
//
// LA REGLA YA ERA ESA y está comprobado contra producción (16/09): Cristian
// Marquez Castan tiene UNA franja vigente, lunes 18:30–19:30, con
// fecha_inicio 2026-10-01, así que el 1 de octubre el aviso se cae solo. Las
// otras filas suyas que aparecen en la tabla están CERRADAS (`fecha_fin` con
// valor): son el histórico de cambios de horario, no duplicados. De 187 filas,
// 89 están vigentes y entre ellas no hay ni un hueco repetido.
//
// LO QUE SÍ ESTABA MAL era de dónde salía "hoy": `toISOString()` da la fecha
// en UTC y España va por delante, así que entre medianoche y las dos de la
// madrugada "hoy" era ayer y el aviso aguantaba un par de horas de más. Es
// poco daño en una academia que abre por la tarde, y es exactamente la clase
// de desajuste que después no se encuentra.
export async function run({ test, assert }) {
  const { hoyYMD, textoDesde, tituloDesde } = await import("../../assets/shared/js/desdeFecha.js");

  // ── Cuándo se pone y cuándo se quita ─────────────────────────────────

  test("el aviso sale mientras la fecha no llega", () => {
    assert.equal(textoDesde("2026-10-01", "2026-09-16"), "desde 1/10");
    assert.equal(textoDesde("2026-10-01", "2026-09-30"), "desde 1/10");
  });

  test("el día que empieza, el aviso YA no sale", () => {
    // El alumno ya viene ese día: el aviso diría que no.
    assert.equal(textoDesde("2026-10-01", "2026-10-01"), "");
    assert.equal(textoDesde("2026-10-01", "2026-10-02"), "");
  });

  test("sin fecha de inicio no hay aviso: son casi todos", () => {
    assert.equal(textoDesde(null, "2026-09-16"), "");
    assert.equal(textoDesde("", "2026-09-16"), "");
    assert.equal(textoDesde(undefined, "2026-09-16"), "");
  });

  test("una fecha con hora dentro (timestamp de Postgres) se corta bien", () => {
    assert.equal(textoDesde("2026-10-01T00:00:00+00:00", "2026-09-16"), "desde 1/10");
  });

  test("el día y el mes van sin cero delante, como se dice en voz alta", () => {
    assert.equal(textoDesde("2026-01-07", "2025-12-31"), "desde 7/1");
  });

  test("el título explica la consecuencia, que es lo que no se adivina", () => {
    assert.match(tituloDesde("2026-10-01"), /empieza el 01\/10\/2026/);
    assert.match(tituloDesde("2026-10-01"), /todavía no aparece en el Diario/);
  });

  // ── De dónde sale "hoy" ──────────────────────────────────────────────

  test("REGRESIÓN: 'hoy' es la fecha del ordenador, no la de UTC", () => {
    // A las 00:30 del 1 de octubre en España, UTC va todavía por el 30 de
    // septiembre: con toISOString el alumno de octubre seguía marcado.
    const tzOriginal = process.env.TZ;
    try {
      process.env.TZ = "Europe/Madrid";
      const medianocheEspanola = new Date("2026-10-01T00:30:00+02:00");
      assert.equal(
        medianocheEspanola.toISOString().slice(0, 10), "2026-09-30",
        "si esto cambia, el test ya no prueba nada"
      );
      assert.equal(hoyYMD(medianocheEspanola), "2026-10-01");
      // Y con eso, el aviso de Cristian desaparece a la hora correcta.
      assert.equal(textoDesde("2026-10-01", hoyYMD(medianocheEspanola)), "");
    } finally {
      if (tzOriginal === undefined) delete process.env.TZ;
      else process.env.TZ = tzOriginal;
    }
  });

  test("los meses y días de una cifra llevan cero: la comparación es de cadenas", () => {
    // "2026-9-7" ordenaría mal contra "2026-10-01" al comparar como texto.
    assert.equal(hoyYMD(new Date(2026, 8, 7, 12, 0)), "2026-09-07");
    assert.equal(hoyYMD(new Date(2026, 11, 25, 12, 0)), "2026-12-25");
  });
}
