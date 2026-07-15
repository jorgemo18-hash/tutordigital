export async function run({ test, assert }) {
  const { buildHojaInscripcionPayload } = await import("../server/lib/academiaDocumentos/payload.js");
  const { INSCRIPCION_CONFIG_DEFAULTS } = await import("../server/lib/academiaConfig/inscripcionConfig.js");

  test("buildHojaInscripcionPayload: mapea las columnas de academia_config esperadas", () => {
    const config = {
      nombre_emisor: "Lyceo",
      ciudad_emisor: "Huesca",
      logo_url: "https://x/logo.png",
      iban: "ES04 0182 3107 1202 0166 6835",
      bizum_emisor: "675 32 41 28",
    };
    const payload = buildHojaInscripcionPayload(config, "Tenant fallback");
    assert.deepEqual(payload, {
      nombre: "Lyceo",
      ciudad: "Huesca",
      logo_url: "https://x/logo.png",
      iban: "ES04 0182 3107 1202 0166 6835",
      bizum_emisor: "675 32 41 28",
      campos: INSCRIPCION_CONFIG_DEFAULTS,
      texto_legal: "",
    });
  });

  test("buildHojaInscripcionPayload: usa tenantNombre como fallback y vacíos si falta el resto", () => {
    const payload = buildHojaInscripcionPayload({}, "Mi Academia");
    assert.deepEqual(payload, {
      nombre: "Mi Academia",
      ciudad: "",
      logo_url: "",
      iban: "",
      bizum_emisor: "",
      campos: INSCRIPCION_CONFIG_DEFAULTS,
      texto_legal: "",
    });
  });

  test("buildHojaInscripcionPayload: propaga el texto legal recibido", () => {
    const payload = buildHojaInscripcionPayload({}, "Mi Academia", "Texto de protección de datos.");
    assert.equal(payload.texto_legal, "Texto de protección de datos.");
  });

  test("buildHojaInscripcionPayload: inscripcion_config guardado en config se resuelve con defaults para lo que falte", () => {
    const config = { inscripcion_config: { alumno: { curso: false } } };
    const payload = buildHojaInscripcionPayload(config, "Mi Academia");
    assert.equal(payload.campos.alumno.curso, false);
    // el resto de alumno (fecha_nacimiento, dni, email, telefono) sigue con
    // el default aunque no viniera en el objeto guardado
    assert.equal(payload.campos.alumno.email, INSCRIPCION_CONFIG_DEFAULTS.alumno.email);
    assert.deepEqual(payload.campos.familia, INSCRIPCION_CONFIG_DEFAULTS.familia);
  });
}
