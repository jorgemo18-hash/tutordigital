// REGRESIÓN: "Enviar a todos" contaba como envío correcto una familia que
// había recibido el email SIN el recibo.
//
// El envío degrada a propósito: si el PDF del recibo falla pero el del
// informe se genera, el email sale igual con lo que haya. El backend lo
// reportaba (reciboAdjuntado:false) pero envioFamiliasSection.js descartaba
// la respuesta y sumaba +1 a "familias al día". Resultado: el admin cerraba
// el portátil convencido de haber facturado.
export async function run({ test, assert }) {
  const { clasificarEnvio } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/resultadoEnvio.js"
  );

  test("todo adjuntado -> completo", () => {
    const r = clasificarEnvio("completo", { reciboAdjuntado: true, informesAdjuntados: 2, informesElegibles: 2 });
    assert.equal(r.completo, true);
    assert.deepEqual(r.faltas, []);
  });

  test("REGRESIÓN: recibo no adjuntado -> NO es completo", () => {
    const r = clasificarEnvio("completo", { reciboAdjuntado: false, informesAdjuntados: 1, informesElegibles: 1 });
    assert.equal(r.completo, false);
    assert.deepEqual(r.faltas, ["no se pudo generar el recibo"]);
  });

  test("faltan informes -> lo dice con el recuento", () => {
    const r = clasificarEnvio("completo", { reciboAdjuntado: true, informesAdjuntados: 1, informesElegibles: 3 });
    assert.equal(r.completo, false);
    assert.deepEqual(r.faltas, ["faltó 2 informes de 3"]);
  });

  test("un solo informe que falta se dice en singular", () => {
    const r = clasificarEnvio("completo", { reciboAdjuntado: true, informesAdjuntados: 0, informesElegibles: 1 });
    assert.deepEqual(r.faltas, ["faltó 1 informe de 1"]);
  });

  test("solo_recibo no se queja de informes que no iban en ese envío", () => {
    const r = clasificarEnvio("solo_recibo", { reciboAdjuntado: true, informesAdjuntados: 0, informesElegibles: 3 });
    assert.equal(r.completo, true);
  });

  test("solo_informe no se queja del recibo que no iba en ese envío", () => {
    const r = clasificarEnvio("solo_informe", { reciboAdjuntado: false, informesAdjuntados: 2, informesElegibles: 2 });
    assert.equal(r.completo, true);
  });

  test("un aviso de estado (email enviado pero no marcado) también rompe el 'completo'", () => {
    const r = clasificarEnvio("completo", {
      reciboAdjuntado: true, informesAdjuntados: 1, informesElegibles: 1,
      avisosEstado: ["el recibo se envió pero no se pudo marcar como enviado"],
    });
    assert.equal(r.completo, false);
    assert.deepEqual(r.faltas, ["el recibo se envió pero no se pudo marcar como enviado"]);
  });

  test("respuesta vacía (backend antiguo) no inventa faltas de informes", () => {
    const r = clasificarEnvio("solo_informe", {});
    assert.equal(r.completo, true, "0 elegibles y 0 adjuntados no es una falta");
  });
}
