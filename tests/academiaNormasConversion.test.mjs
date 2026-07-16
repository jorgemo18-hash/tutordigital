import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

function conStorage(admin, { uploadError = null, uploadCalls = [] } = {}) {
  admin.storage = {
    from() {
      return {
        upload: async (path, buf) => {
          uploadCalls.push({ path, buf });
          return { error: uploadError };
        },
      };
    },
  };
  return admin;
}

export async function run({ test, assert }) {
  const { convertirNormasDocxAPdf } = await import("../server/lib/academiaDocumentos/convertirNormasDocx.js");
  const { subirNormasConConversion } = await import("../server/lib/academiaDocumentos/subirNormasConConversion.js");

  test("convertirNormasDocxAPdf: éxito al primer intento -> ok con el buffer del PDF", async () => {
    const originalFetch = globalThis.fetch;
    let calledUrl = "";
    globalThis.fetch = async (url) => {
      calledUrl = String(url || "");
      return { ok: true, arrayBuffer: async () => Buffer.from("%PDF-1.4 fake") };
    };
    try {
      const res = await convertirNormasDocxAPdf("http://pdf-service.local", "ZG9jeA==");
      assert.equal(res.ok, true);
      assert.ok(res.buffer.equals(Buffer.from("%PDF-1.4 fake")));
      assert.equal(calledUrl, "http://pdf-service.local/convertir-docx");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Ambos intentos fallan siempre en esta suite (nunca solo el primero):
  // convertirNormasDocxAPdf reintenta una vez tras 5s reales sin importar
  // el motivo del primer fallo, así que cualquier test de fallo paga ese
  // coste — se cubre una vez por cada clasificación de error (red vs.
  // respuesta no-200) en vez de añadir además un tercer test solo para el
  // caso "falla y el reintento sí funciona", ya cubierto en espíritu por
  // el test de éxito de arriba.
  test("convertirNormasDocxAPdf: los dos intentos fallan (red) -> pdf_service_unreachable", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("network down"); };
    try {
      const res = await convertirNormasDocxAPdf("http://pdf-service.local", "ZG9jeA==");
      assert.equal(res.ok, false);
      assert.equal(res.code, "pdf_service_unreachable");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("convertirNormasDocxAPdf: respuesta no-200 -> pdf_service_failed con el motivo del microservicio", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: "LibreOffice reventó" }),
    });
    try {
      const res = await convertirNormasDocxAPdf("http://pdf-service.local", "ZG9jeA==");
      assert.equal(res.ok, false);
      assert.equal(res.code, "pdf_service_failed");
      assert.equal(res.motivo, "LibreOffice reventó");
      assert.equal(res.pdfServiceStatus, 500);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("subirNormasConConversion: mime PDF -> guarda directo, sin llamar al conversor", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_config: [] }));
    let conversorLlamado = false;
    const res = await subirNormasConConversion(
      admin,
      "tenant-1",
      { base64Input: "aG9sYQ==", mime: "application/pdf", pdfServiceUrl: "http://pdf-service.local" },
      { convertirDocxFn: async () => { conversorLlamado = true; return { ok: true, buffer: Buffer.from("x") }; } }
    );
    assert.equal(res.ok, true);
    assert.equal(conversorLlamado, false);
    const fila = admin._state.tables.academia_config.find((c) => c.tenant_id === "tenant-1");
    assert.equal(fila.normas_mime, "application/pdf");
  });

  // Caso pedido explícitamente: flujo completo de subida DOCX -> conversión
  // (microservicio mockeado) -> se persiste PDF, nunca el DOCX original.
  test("subirNormasConConversion: mime DOCX -> convierte y persiste PDF (microservicio mockeado)", async () => {
    const uploadCalls = [];
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_config: [] }), { uploadCalls });
    let pdfServiceUrlRecibida = null;
    let base64DocxRecibido = null;
    const res = await subirNormasConConversion(
      admin,
      "tenant-1",
      { base64Input: "ZG9jeC1jcnVkbw==", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdfServiceUrl: "http://pdf-service.local" },
      {
        convertirDocxFn: async (pdfServiceUrl, base64Docx) => {
          pdfServiceUrlRecibida = pdfServiceUrl;
          base64DocxRecibido = base64Docx;
          return { ok: true, buffer: Buffer.from("%PDF-1.4 convertido") };
        },
      }
    );
    assert.equal(res.ok, true);
    assert.equal(pdfServiceUrlRecibida, "http://pdf-service.local");
    assert.equal(base64DocxRecibido, "ZG9jeC1jcnVkbw==");

    const fila = admin._state.tables.academia_config.find((c) => c.tenant_id === "tenant-1");
    assert.equal(fila.normas_path, "tenant-1/normas.pdf", "se guarda como .pdf, no .docx, aunque el original fuera Word");
    assert.equal(fila.normas_mime, "application/pdf");

    assert.equal(uploadCalls.length, 1);
    assert.equal(uploadCalls[0].path, "tenant-1/normas.pdf");
    assert.ok(uploadCalls[0].buf.toString().includes("PDF-1.4 convertido"), "el contenido persistido es el PDF convertido, no el DOCX original");
  });

  test("subirNormasConConversion: falla la conversión -> no se llega a guardar nada", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_config: [] }));
    let subirLlamado = false;
    const res = await subirNormasConConversion(
      admin,
      "tenant-1",
      { base64Input: "ZG9jeC1jcnVkbw==", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdfServiceUrl: "http://pdf-service.local" },
      {
        convertirDocxFn: async () => ({ ok: false, code: "pdf_service_unreachable", motivo: "No se pudo contactar." }),
        subirNormasFn: async () => { subirLlamado = true; return { ok: true }; },
      }
    );
    assert.equal(res.ok, false);
    assert.equal(res.code, "pdf_service_unreachable");
    assert.equal(subirLlamado, false);
  });
}
