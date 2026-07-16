import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "fixtures", "documentos");
const DOCX_FIXTURE = path.join(FIXTURES_DIR, "normas-fixture.docx");
const PDF_FIXTURE = path.join(FIXTURES_DIR, "normas-fixture.pdf");
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

function conStorage(admin, { uploadCalls = [] } = {}) {
  admin.storage = {
    from() {
      return {
        upload: async (uploadPath, buf) => {
          uploadCalls.push({ path: uploadPath, buf });
          return { error: null };
        },
      };
    },
  };
  return admin;
}

// Test de integración de la regresión real de producción (400
// invalid_base64 al pulsar "Reemplazar" en Normas de la academia,
// introducida por el commit 6425cc7): un DOCX de VERDAD leído de disco
// (fixtures/documentos/normas-fixture.docx — OOXML válido, no un string
// inventado), pasado por el ESQUEMA DE VALIDACIÓN REAL del endpoint
// (UploadBodySchema, dentro de manejarSubidaNormas.js) y por la
// DECODIFICACIÓN REAL de base64 (getBase64FromMaybeDataUrl, dentro de
// subirNormasConConversion.js) — nada de eso se mockea. Lo único mockeado
// es `fetch`, la llamada HTTP al microservicio de conversión.
//
// Los 6 tests de Playwright de 6425cc7 (academia-admin-documentos.spec.mjs)
// pasan en verde con este bug presente en producción porque mockean la
// propia ruta HTTP entera (page.route("**/api/v1/academia/documentos/normas", ...))
// — el body que arma el frontend nunca llega a ejecutar la validación ni
// el mapeo de campos reales del backend, así que un bug ahí (el nombre de
// campo base64/base64Input desalineado) es invisible para esos tests. Este
// archivo cubre exactamente ese hueco.
export async function run({ test, assert }) {
  const { manejarSubidaNormas } = await import("../server/lib/academiaDocumentos/manejarSubidaNormas.js");

  test("manejarSubidaNormas: DOCX real (fixture en disco) se valida, convierte con el microservicio (mockeado) y se persiste como PDF", async () => {
    const docxBuffer = fs.readFileSync(DOCX_FIXTURE);
    // Mismo shape exacto que arma el frontend al pulsar "Reemplazar" (ver
    // apiDocumentos.js/fileUtils.js): base64 puro, sin prefijo data:...;base64,.
    const body = { base64: docxBuffer.toString("base64"), mime: DOCX_MIME };

    const uploadCalls = [];
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_config: [] }), { uploadCalls });

    const originalFetch = globalThis.fetch;
    let pdfServiceUrlLlamada = null;
    globalThis.fetch = async (url) => {
      pdfServiceUrlLlamada = String(url || "");
      return { ok: true, arrayBuffer: async () => Buffer.from("%PDF-1.4 convertido-de-verdad") };
    };

    let resultado;
    try {
      resultado = await manejarSubidaNormas(body, { admin, tenantId: "tenant-1", pdfServiceUrl: "http://pdf-service.local" });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(resultado.ok, true, `esperaba ok:true, llegó ${JSON.stringify(resultado)}`);
    assert.equal(pdfServiceUrlLlamada, "http://pdf-service.local/convertir-docx");

    assert.equal(uploadCalls.length, 1);
    assert.equal(uploadCalls[0].path, "tenant-1/normas.pdf", "se persiste como .pdf, nunca el .docx original");
    assert.ok(uploadCalls[0].buf.toString().includes("PDF-1.4 convertido-de-verdad"));

    const fila = admin._state.tables.academia_config.find((c) => c.tenant_id === "tenant-1");
    assert.equal(fila.normas_mime, PDF_MIME);
  });

  test("manejarSubidaNormas: PDF real (fixture en disco) se valida y se persiste tal cual, sin llamar al microservicio", async () => {
    const pdfBuffer = fs.readFileSync(PDF_FIXTURE);
    const body = { base64: pdfBuffer.toString("base64"), mime: PDF_MIME };

    const uploadCalls = [];
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_config: [] }), { uploadCalls });

    const originalFetch = globalThis.fetch;
    let fetchLlamado = false;
    globalThis.fetch = async () => { fetchLlamado = true; return { ok: true, arrayBuffer: async () => Buffer.from("no debería llamarse") }; };

    let resultado;
    try {
      resultado = await manejarSubidaNormas(body, { admin, tenantId: "tenant-1", pdfServiceUrl: "http://pdf-service.local" });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(resultado.ok, true, `esperaba ok:true, llegó ${JSON.stringify(resultado)}`);
    assert.equal(fetchLlamado, false, "un PDF no pasa por el conversor — este es justo el otro camino que rompía el mismo bug");
    assert.equal(uploadCalls.length, 1);
    assert.ok(uploadCalls[0].buf.equals(pdfBuffer), "el PDF se persiste byte a byte, sin recodificar");
  });

  test("manejarSubidaNormas: body inválido (sin base64) -> invalid_body, nunca llega a decodificar nada", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_config: [] }));
    const resultado = await manejarSubidaNormas({ mime: PDF_MIME }, { admin, tenantId: "tenant-1", pdfServiceUrl: "http://pdf-service.local" });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, "invalid_body");
  });
}
