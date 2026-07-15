export async function run({ test, assert }) {
  const { INSCRIPCION_CONFIG_DEFAULTS, resolverInscripcionConfig } = await import(
    "../server/lib/academiaConfig/inscripcionConfig.js"
  );

  test("resolverInscripcionConfig: null (columna nunca tocada) devuelve los defaults tal cual", () => {
    assert.deepEqual(resolverInscripcionConfig(null), INSCRIPCION_CONFIG_DEFAULTS);
  });

  test("resolverInscripcionConfig: no-objeto (undefined, string...) también cae a defaults", () => {
    assert.deepEqual(resolverInscripcionConfig(undefined), INSCRIPCION_CONFIG_DEFAULTS);
    assert.deepEqual(resolverInscripcionConfig("no-es-un-objeto"), INSCRIPCION_CONFIG_DEFAULTS);
  });

  test("resolverInscripcionConfig: objeto vacío devuelve los defaults (no revienta por bloques ausentes)", () => {
    assert.deepEqual(resolverInscripcionConfig({}), INSCRIPCION_CONFIG_DEFAULTS);
  });

  test("resolverInscripcionConfig: un bloque parcial se completa con sus defaults, el resto de bloques queda intacto", () => {
    const resuelto = resolverInscripcionConfig({ alumno: { dni: true } });
    assert.equal(resuelto.alumno.dni, true);
    assert.equal(resuelto.alumno.curso, INSCRIPCION_CONFIG_DEFAULTS.alumno.curso);
    assert.equal(resuelto.alumno.fecha_nacimiento, INSCRIPCION_CONFIG_DEFAULTS.alumno.fecha_nacimiento);
    assert.deepEqual(resuelto.familia, INSCRIPCION_CONFIG_DEFAULTS.familia);
    assert.deepEqual(resuelto.metodo_pago, INSCRIPCION_CONFIG_DEFAULTS.metodo_pago);
  });

  test("resolverInscripcionConfig: config completa guardada se respeta sin tocarla", () => {
    const completa = {
      alumno: { fecha_nacimiento: true, dni: true, curso: false, email: false, telefono: true },
      familia: {
        activo: false,
        nombre_tutor: false,
        apellidos: false,
        dni: false,
        direccion: false,
        codigo_postal: false,
        telefono: false,
        email: false,
      },
      metodo_pago: { activo: true, domiciliado: false, transferencia: true, bizum: false, efectivo: true },
      preferencia_cobro: { activo: false },
      autorizaciones: { activo: true, salida_sin_acompanante: true },
    };
    assert.deepEqual(resolverInscripcionConfig(completa), completa);
  });

  test("defaults: alumno solo excluye fecha_nacimiento, dni y telefono — curso y email activos", () => {
    assert.equal(INSCRIPCION_CONFIG_DEFAULTS.alumno.fecha_nacimiento, false);
    assert.equal(INSCRIPCION_CONFIG_DEFAULTS.alumno.dni, false);
    assert.equal(INSCRIPCION_CONFIG_DEFAULTS.alumno.telefono, false);
    assert.equal(INSCRIPCION_CONFIG_DEFAULTS.alumno.curso, true);
    assert.equal(INSCRIPCION_CONFIG_DEFAULTS.alumno.email, true);
  });

  test("defaults: autorizaciones apagado por completo, el resto de bloques activo", () => {
    assert.equal(INSCRIPCION_CONFIG_DEFAULTS.autorizaciones.activo, false);
    assert.equal(INSCRIPCION_CONFIG_DEFAULTS.autorizaciones.salida_sin_acompanante, false);
    assert.equal(INSCRIPCION_CONFIG_DEFAULTS.familia.activo, true);
    assert.equal(INSCRIPCION_CONFIG_DEFAULTS.metodo_pago.activo, true);
    assert.equal(INSCRIPCION_CONFIG_DEFAULTS.preferencia_cobro.activo, true);
  });
}
