import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

const TENANT_ID = "t1";
const FAMILIA_ID = "f1";

function fixture({
  conRecibo = true,
  reciboEstado = "borrador",
  informesDeAlumnos = { a1: "Comentario de Ana" },
  informesEnviadosAt = {},
} = {}) {
  const alumnos = [
    { id: "a1", tenant_id: TENANT_ID, familia_id: FAMILIA_ID, nombre: "Ana García", curso: "1º ESO", activo: true },
    { id: "a2", tenant_id: TENANT_ID, familia_id: FAMILIA_ID, nombre: "Luis García", curso: "3º ESO", activo: true },
  ];
  const alumnosConInforme = Object.keys(informesDeAlumnos);
  return makeFakeSupabaseAdmin({
    academia_familias: [{
      id: FAMILIA_ID, tenant_id: TENANT_ID, nombre: "Familia García", email: "familia@example.com",
      dni: "", direccion: "", codigo_postal: "", ciudad: "", metodo_pago: "transferencia",
    }],
    academia_alumnos: alumnos.filter((a) => alumnosConInforme.length || a.id === "a1" || a.id === "a2"),
    academia_config: [{
      tenant_id: TENANT_ID, nombre_emisor: "Academia Lyceo", email_emisor: "info@lyceoacademia.es",
      email_texto_completo: "Hola {familia}, os adjuntamos el recibo de {mes} ({total}) y el informe.",
      email_texto_solo_recibo: "Hola {familia}, SOLO el recibo de {mes} ({total}).",
      email_texto_solo_informe: "Hola {familia}, SOLO el informe.",
    }],
    academia_textos_legales: [
      { tenant_id: TENANT_ID, tipo: "email", contenido: "Texto LOPD de Marca y textos.", activo: true },
      { tenant_id: TENANT_ID, tipo: "recibos", contenido: "Operación exenta de IVA.", activo: true },
    ],
    academia_recibos: conRecibo
      ? [{
          id: "r1", tenant_id: TENANT_ID, familia_id: FAMILIA_ID, mes: 7, anio: 2026,
          concepto: "Julio 2026", numero_recibo: "REC-2026-008", created_at: "2026-07-01T00:00:00.000Z",
          total_bruto: 200, total_descuento: 30, total_neto: 170,
          descuento_puntual_pct: 0, descuento_puntual_nota: null, descuento_hermanos_pct: 0,
          estado: reciboEstado, fecha_envio: reciboEstado !== "borrador" ? "2026-07-01T10:00:00.000Z" : null,
          familia: { id: FAMILIA_ID, nombre: "Familia García", email: "familia@example.com" },
        }]
      : [],
    academia_recibos_lineas: [
      { id: "l1", recibo_id: "r1", alumno_id: "a1", nombre_alumno: "Ana García", curso_alumno: "1º ESO", precio_bruto: 100, descripcion: "Julio 2026", descuentos_recurrentes: [] },
      { id: "l2", recibo_id: "r1", alumno_id: "a2", nombre_alumno: "Luis García", curso_alumno: "3º ESO", precio_bruto: 100, descripcion: "Julio 2026", descuentos_recurrentes: [] },
    ],
    academia_informes: alumnosConInforme.map((alumnoId, i) => ({
      id: `inf${i + 1}`, tenant_id: TENANT_ID, alumno_id: alumnoId, mes: 7, anio: 2026,
      comentario: informesDeAlumnos[alumnoId], enviado_at: informesEnviadosAt[alumnoId] || null,
    })),
    academia_sesiones: [],
    academia_festivos: [],
  });
}

function fakesOk() {
  const llamadas = { recibo: [], informe: [], email: [] };
  return {
    llamadas,
    generarReciboPdfFn: async (args) => { llamadas.recibo.push(args); return { ok: true, buffer: Buffer.from("PDF-RECIBO") }; },
    generarInformePdfFn: async (args) => { llamadas.informe.push(args); return { ok: true, buffer: Buffer.from("PDF-INFORME") }; },
    enviarEmailFn: async (args) => { llamadas.email.push(args); },
  };
}

export async function run({ test, assert }) {
  const { enviarReciboYInformesDeFamilia } = await import("../../server/lib/academiaEnvio/enviarFamiliaEmail.js");

  test("ambos PDF ok -> 1 email con 2 adjuntos (recibo + 1 informe), recibo e informe quedan marcados como enviados", async () => {
    const admin = fixture();
    const fakes = fakesOk();
    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.reciboAdjuntado, true);
    assert.equal(resultado.informesAdjuntados, 1);
    assert.equal(fakes.llamadas.email.length, 1);
    assert.equal(fakes.llamadas.email[0].attachments.length, 2);
    assert.equal(fakes.llamadas.email[0].to, "familia@example.com");

    const recibo = admin._state.tables.academia_recibos.find((r) => r.id === "r1");
    assert.equal(recibo.estado, "enviado");
    assert.ok(recibo.fecha_envio);
    const informe = admin._state.tables.academia_informes.find((i) => i.id === "inf1");
    assert.ok(informe.enviado_at);
  });

  test("el cuerpo del email sustituye las variables y lleva el footer LOPD", async () => {
    const admin = fixture();
    const fakes = fakesOk();
    await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });
    const html = fakes.llamadas.email[0].html;
    assert.equal(html.includes("Hola Familia García"), true);
    assert.equal(html.includes("170.00"), true, "el {total} debe ser el neto del recibo");
    assert.equal(html.includes("Texto LOPD de Marca y textos."), true);
  });

  test("recibo falla, informe ok -> envía solo con el adjunto del informe; el recibo NO se marca enviado, el informe SÍ", async () => {
    const admin = fixture();
    const fakes = fakesOk();
    fakes.generarReciboPdfFn = async () => ({ ok: false, code: "pdf_service_failed", motivo: "cold start" });

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.reciboAdjuntado, false);
    assert.equal(resultado.informesAdjuntados, 1);
    assert.equal(fakes.llamadas.email[0].attachments.length, 1);

    const recibo = admin._state.tables.academia_recibos.find((r) => r.id === "r1");
    assert.equal(recibo.estado, "borrador", "un recibo cuyo PDF falló no debe marcarse como enviado");
    const informe = admin._state.tables.academia_informes.find((i) => i.id === "inf1");
    assert.ok(informe.enviado_at);
  });

  test("ambos PDF fallan -> no se envía nada, error sin_contenido", async () => {
    const admin = fixture();
    const fakes = fakesOk();
    fakes.generarReciboPdfFn = async () => ({ ok: false, code: "pdf_service_failed", motivo: "cold start" });
    fakes.generarInformePdfFn = async () => ({ ok: false, code: "pdf_service_failed", motivo: "cold start" });

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "sin_contenido");
    assert.equal(fakes.llamadas.email.length, 0);
    const recibo = admin._state.tables.academia_recibos.find((r) => r.id === "r1");
    assert.equal(recibo.estado, "borrador");
  });

  test("familia con 2 alumnos con informe ya generado -> 1 email con 3 adjuntos (recibo + 2 informes)", async () => {
    const admin = fixture({ informesDeAlumnos: { a1: "Comentario de Ana", a2: "Comentario de Luis" } });
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.informesAdjuntados, 2);
    assert.equal(fakes.llamadas.email[0].attachments.length, 3);
  });

  test("alumno activo SIN informe generado (comentario null) no genera adjunto ni se toca", async () => {
    const admin = fixture({ informesDeAlumnos: {} });
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.informesAdjuntados, 0);
    assert.equal(fakes.llamadas.informe.length, 0, "nunca debe intentar generar el PDF de un informe sin comentario");
    assert.equal(fakes.llamadas.email[0].attachments.length, 1, "solo el recibo");
  });

  test("familia sin recibo este mes -> {total} queda vacío en el cuerpo, y solo se adjunta el informe", async () => {
    const admin = fixture({ conRecibo: false });
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.reciboAdjuntado, false);
    assert.equal(resultado.informesAdjuntados, 1);
    assert.equal(fakes.llamadas.email[0].attachments.length, 1);
    assert.equal(fakes.llamadas.email[0].html.includes("recibo de julio ()"), true, "sin recibo, {total} se sustituye por vacío");
  });

  test("familia sin email -> no intenta generar nada ni enviar", async () => {
    const admin = fixture();
    admin._state.tables.academia_familias[0].email = null;
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "sin_email");
    assert.equal(fakes.llamadas.recibo.length, 0);
    assert.equal(fakes.llamadas.email.length, 0);
  });

  test("tipoEnvio 'solo_recibo' -> ni siquiera intenta generar el informe, aunque exista con comentario", async () => {
    const admin = fixture({ informesDeAlumnos: { a1: "Comentario de Ana" } });
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test",
      tipoEnvio: "solo_recibo", ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.reciboAdjuntado, true);
    assert.equal(resultado.informesAdjuntados, 0);
    assert.equal(fakes.llamadas.informe.length, 0, "solo_recibo no debe generar ningún PDF de informe");
    assert.equal(fakes.llamadas.email[0].attachments.length, 1);
    const informe = admin._state.tables.academia_informes.find((i) => i.id === "inf1");
    assert.equal(informe.enviado_at, null, "solo_recibo no debe tocar el informe");
  });

  test("tipoEnvio 'solo_recibo' usa email_texto_solo_recibo, no el de completo", async () => {
    const admin = fixture();
    const fakes = fakesOk();
    await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test",
      tipoEnvio: "solo_recibo", ...fakes,
    });
    assert.equal(fakes.llamadas.email[0].html.includes("SOLO el recibo"), true);
  });

  test("tipoEnvio 'solo_informe' -> ni siquiera intenta generar el recibo, aunque exista", async () => {
    const admin = fixture({ informesDeAlumnos: { a1: "Comentario de Ana" } });
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test",
      tipoEnvio: "solo_informe", ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.reciboAdjuntado, false);
    assert.equal(resultado.informesAdjuntados, 1);
    assert.equal(fakes.llamadas.recibo.length, 0, "solo_informe no debe generar ningún PDF de recibo");
    assert.equal(fakes.llamadas.email[0].attachments.length, 1);
    const recibo = admin._state.tables.academia_recibos.find((r) => r.id === "r1");
    assert.equal(recibo.estado, "borrador", "solo_informe no debe tocar el recibo");
  });

  test("tipoEnvio 'solo_informe' usa email_texto_solo_informe, sin {total}", async () => {
    const admin = fixture();
    const fakes = fakesOk();
    await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test",
      tipoEnvio: "solo_informe", ...fakes,
    });
    assert.equal(fakes.llamadas.email[0].html.includes("SOLO el informe"), true);
  });

  test("forward-only: recibo ya enviado + completo + sin confirmar -> requiere_confirmacion, no genera NINGÚN pdf ni envía nada", async () => {
    const admin = fixture({ reciboEstado: "enviado" });
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "requiere_confirmacion");
    assert.equal(resultado.afectados, 1);
    assert.equal(fakes.llamadas.recibo.length, 0);
    assert.equal(fakes.llamadas.informe.length, 0);
    assert.equal(fakes.llamadas.email.length, 0);
  });

  test("forward-only: recibo ya pagado + completo + confirmar:true -> reenvía normalmente", async () => {
    const admin = fixture({ reciboEstado: "pagado" });
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test",
      confirmar: true, ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(fakes.llamadas.email.length, 1);
  });

  test("forward-only: informe ya enviado + completo + sin confirmar -> requiere_confirmacion aunque el recibo esté en borrador", async () => {
    const admin = fixture({ informesEnviadosAt: { a1: "2026-07-01T00:00:00.000Z" } });
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "requiere_confirmacion");
    assert.equal(resultado.afectados, 1);
  });

  test("forward-only: tipoEnvio 'solo_recibo' con informe ya enviado NO bloquea (el informe no va en este envío)", async () => {
    const admin = fixture({ informesEnviadosAt: { a1: "2026-07-01T00:00:00.000Z" } });
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test",
      tipoEnvio: "solo_recibo", ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
  });

  test("forward-only: tipoEnvio 'solo_informe' con recibo ya enviado NO bloquea (el recibo no va en este envío)", async () => {
    const admin = fixture({ reciboEstado: "enviado" });
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test",
      tipoEnvio: "solo_informe", ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
  });

  // REGRESIÓN: reenviar un recibo YA COBRADO lo devolvía a "enviado" con la
  // fecha_pago todavía puesta. Finanzas › Ingresos decide si algo está
  // cobrado mirando SOLO `estado` (ingresosConsultas.js), así que el cobro
  // desaparecía de la lista de pagados. Falla si se vuelve a escribir
  // `estado: "enviado"` incondicionalmente en enviarFamiliaEmail.js.
  test("REGRESIÓN: reenviar un recibo pagado NO lo devuelve a 'enviado'", async () => {
    const admin = fixture({ reciboEstado: "pagado" });
    const fakes = fakesOk();

    const resultado = await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test",
      confirmar: true, ...fakes,
    });

    assert.equal(resultado.ok, true, resultado.motivo);
    assert.equal(resultado.reciboAdjuntado, true, "el recibo sí se adjunta y se envía");
    const recibo = admin._state.tables.academia_recibos.find((r) => r.id === "r1");
    assert.equal(recibo.estado, "pagado", "enviar no puede deshacer un cobro");
    assert.ok(recibo.fecha_envio, "y sí actualiza la fecha de envío");
  });

  test("un recibo en borrador sí pasa a 'enviado' al enviarlo", async () => {
    const admin = fixture();
    const fakes = fakesOk();

    await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    const recibo = admin._state.tables.academia_recibos.find((r) => r.id === "r1");
    assert.equal(recibo.estado, "enviado");
  });

  test("REGRESIÓN: el email va firmado por la academia y responde a su dirección", async () => {
    // Salía siempre como "TutorDigital" y sin reply_to: la familia recibía
    // el recibo de una marca que no conoce y, al responder, el mensaje se
    // perdía. Aquí se comprueba que la config del centro llega de verdad
    // hasta la llamada de envío, no solo que remitente.js la sepa construir.
    const admin = fixture();
    const fakes = fakesOk();

    await enviarReciboYInformesDeFamilia(admin, {
      tenantId: TENANT_ID, tenantNombre: "Lyceo", familiaId: FAMILIA_ID, mes: 7, anio: 2026, pdfServiceUrl: "http://pdf.test", ...fakes,
    });

    const [email] = fakes.llamadas.email;
    assert.equal(email.from, '"Academia Lyceo" <noreply@tutordigital.app>');
    assert.equal(email.replyTo, "info@lyceoacademia.es");
  });
}
