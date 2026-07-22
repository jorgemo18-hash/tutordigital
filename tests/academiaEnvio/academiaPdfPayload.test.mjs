// buildAcademiaPdfPayload() — reubicado desde academiaInformes/payload.js
// (mismo comportamiento, tests portados: el código que testeaban se movió,
// no cambió). Verifica que el texto de exención de IVA y el footer LOPD
// que recibe el PDF (tutordigital-pdf-service, tanto /recibo como
// /informe) leen SOLO de los arrays textosExencion/textosLopd (que vienen
// de academia_textos_legales), nunca de config.texto_exencion_iva (columna
// en camino de eliminarse, ver migración 090).
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

  test("footer LOPD: mismo comportamiento que exención — join, vacío -> undefined, nunca desde config", () => {
    const conLopd = buildAcademiaPdfPayload({}, "", [], ["Texto LOPD."]);
    assert.equal(conLopd.lopd_footer, "Texto LOPD.");

    const variosLopd = buildAcademiaPdfPayload({}, "", [], ["LOPD 1.", "LOPD 2."]);
    assert.equal(variosLopd.lopd_footer, "LOPD 1. LOPD 2.");

    const sinLopd = buildAcademiaPdfPayload({}, "", []);
    assert.equal(sinLopd.lopd_footer, undefined);
  });

  test("exención y LOPD son independientes entre sí — cada uno con su propio array, sin mezclarse", () => {
    const payload = buildAcademiaPdfPayload({}, "", ["Solo exención."], ["Solo LOPD."]);
    assert.equal(payload.texto_exencion, "Solo exención.");
    assert.equal(payload.lopd_footer, "Solo LOPD.");
  });
}
