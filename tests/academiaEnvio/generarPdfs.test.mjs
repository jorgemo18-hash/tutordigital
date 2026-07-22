// Cubre generarPdfs.js aislado de red/Sentry reales (TUTORDIGITAL-BACKEND-B/C:
// un 502 de la plataforma llegó con una página HTML entera —varios MB, con
// fuentes embebidas en base64— como pdfServiceBody, y Sentry lo capturó tal
// cual). fetchPdfBufferFn/captureExceptionFn inyectables para no depender de
// un servicio real ni de un DSN de Sentry configurado.
export async function run({ test, assert }) {
  const { generarReciboPdf, generarInformePdf } = await import("../../server/lib/academiaEnvio/generarPdfs.js");

  test("fallo del servicio -> captura en Sentry con pdfServiceBody truncado a 500 caracteres", async () => {
    const cuerpoEnorme = "x".repeat(2_000_000);
    const capturas = [];
    const resultado = await generarReciboPdf({
      tenantId: "t1", familiaId: "f1", payload: {}, pdfServiceUrl: "http://pdf.test",
      fetchPdfBufferFn: async () => ({ ok: false, code: "pdf_service_failed", motivo: "El servicio de PDF devolvió un error.", pdfServiceStatus: 502, pdfServiceBody: cuerpoEnorme }),
      captureExceptionFn: (err, ctx) => capturas.push({ err, ctx }),
    });

    assert.equal(resultado.ok, false);
    assert.equal(capturas.length, 1);
    assert.equal(capturas[0].ctx.extra.pdfServiceBody.length, 500);
    assert.equal(capturas[0].ctx.extra.pdfServiceStatus, 502);
    assert.equal(capturas[0].err.message, "generar_recibo_pdf: El servicio de PDF devolvió un error.");
  });

  test("pdfServiceBody corto no se recorta (menos de 500 caracteres, se conserva íntegro)", async () => {
    const capturas = [];
    await generarInformePdf({
      tenantId: "t1", alumnoId: "a1", payload: {}, pdfServiceUrl: "http://pdf.test",
      fetchPdfBufferFn: async () => ({ ok: false, code: "pdf_service_failed", motivo: "x", pdfServiceStatus: 429, pdfServiceBody: "Too Many Requests\n" }),
      captureExceptionFn: (err, ctx) => capturas.push({ err, ctx }),
    });

    assert.equal(capturas[0].ctx.extra.pdfServiceBody, "Too Many Requests\n");
  });

  test("éxito -> no captura nada en Sentry", async () => {
    const capturas = [];
    const resultado = await generarReciboPdf({
      tenantId: "t1", familiaId: "f1", payload: {}, pdfServiceUrl: "http://pdf.test",
      fetchPdfBufferFn: async () => ({ ok: true, buffer: Buffer.from("PDF") }),
      captureExceptionFn: (err, ctx) => capturas.push({ err, ctx }),
    });

    assert.equal(resultado.ok, true);
    assert.equal(capturas.length, 0);
  });

  test("generar_recibo_pdf y generar_informe_pdf usan mensajes de Sentry distintos (no se agrupan en el mismo issue)", async () => {
    const capturas = [];
    const captureExceptionFn = (err) => capturas.push(err.message);
    await generarReciboPdf({
      tenantId: "t1", familiaId: "f1", payload: {}, pdfServiceUrl: "http://pdf.test",
      fetchPdfBufferFn: async () => ({ ok: false, motivo: "falló" }), captureExceptionFn,
    });
    await generarInformePdf({
      tenantId: "t1", alumnoId: "a1", payload: {}, pdfServiceUrl: "http://pdf.test",
      fetchPdfBufferFn: async () => ({ ok: false, motivo: "falló" }), captureExceptionFn,
    });

    assert.deepEqual(capturas, ["generar_recibo_pdf: falló", "generar_informe_pdf: falló"]);
  });
}
