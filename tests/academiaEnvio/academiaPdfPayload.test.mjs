// buildAcademiaPdfPayload() — reubicado desde academiaInformes/payload.js
// (mismo comportamiento, tests portados: el código que testeaban se movió,
// no cambió). Verifica que el texto de exención de IVA que recibe el PDF
// (tutordigital-pdf-service, tanto /recibo como /informe) lee SOLO del
// array textosExencion (que viene de academia_textos_legales), nunca de
// config.texto_exencion_iva (columna en camino de eliminarse, ver
// migración 090).
//
// Ya NO se envía lopd_footer al PDF (decisión de producto 2026-07-30, ver
// docs/deuda-tecnica.md): ningún generador del microservicio lo ha leído
// nunca — el pie LOPD solo aplica al email (buildCuerpoHtml), no al PDF.
export async function run({ test, assert }) {
  const { buildAcademiaPdfPayload } = await import("../../server/lib/academiaEnvio/academiaPdfPayload.js");

  test("con un texto de exención activo -> texto_exencion es ese texto tal cual", () => {
    const payload = buildAcademiaPdfPayload({ nombre_emisor: "Academia X" }, "", ["Operación exenta de IVA según Art. 20.Uno.9º."]);
    assert.equal(payload.texto_exencion, "Operación exenta de IVA según Art. 20.Uno.9º.");
  });

  test("con varios textos de exención activos -> se unen en un único párrafo (el PDF pinta uno solo)", () => {
    const payload = buildAcademiaPdfPayload({}, "Academia X", ["Texto A.", "Texto B."]);
    assert.equal(payload.texto_exencion, "Texto A. Texto B.");
  });

  test("sin ningún texto de exención activo -> texto_exencion undefined (el microservicio aplica su propio default)", () => {
    const payload = buildAcademiaPdfPayload({}, "Academia X", []);
    assert.equal(payload.texto_exencion, undefined);
  });

  test("NUNCA lee config.texto_exencion_iva, aunque esté presente en config — la fuente es solo el array", () => {
    const configConColumnaVieja = { nombre_emisor: "Academia X", texto_exencion_iva: "Texto del sistema viejo, no debe usarse." };
    const payload = buildAcademiaPdfPayload(configConColumnaVieja, "", ["Texto del sistema nuevo."]);
    assert.equal(payload.texto_exencion, "Texto del sistema nuevo.");
    assert.notEqual(payload.texto_exencion, configConColumnaVieja.texto_exencion_iva);
  });

  test("el payload nunca lleva lopd_footer, aunque se le pase un 4º argumento por error", () => {
    const payload = buildAcademiaPdfPayload({}, "", ["Solo exención."], ["esto ya no se usa"]);
    assert.equal(payload.texto_exencion, "Solo exención.");
    assert.equal("lopd_footer" in payload, false);
  });
}
