const MIME_PDF = "application/pdf";
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function run({ test, assert }) {
  const { extraerTextoDocumento } = await import("../server/lib/academiaDocumentos/extraerTextoInscripcion.js");

  test("extraerTextoDocumento: mime no soportado se rechaza", async () => {
    const res = await extraerTextoDocumento({ base64Input: "QQ==", mime: "image/png" });
    assert.equal(res.ok, false);
    assert.equal(res.code, "unsupported_mime");
  });

  test("extraerTextoDocumento: base64 inválido se rechaza", async () => {
    const res = await extraerTextoDocumento({ base64Input: "no-es-base64!!", mime: MIME_PDF });
    assert.equal(res.ok, false);
    assert.equal(res.code, "invalid_base64");
  });

  test("extraerTextoDocumento: archivo por encima de 10MB se rechaza", async () => {
    const enorme = "A".repeat(14_000_000); // ~10.5MB decodificado
    const res = await extraerTextoDocumento({ base64Input: enorme, mime: MIME_PDF });
    assert.equal(res.ok, false);
    assert.equal(res.code, "payload_too_large");
  });

  test("extraerTextoDocumento: DOCX corrupto/no válido devuelve extraction_failed, no revienta la petición", async () => {
    const base64 = Buffer.from("esto no es un docx real").toString("base64");
    const res = await extraerTextoDocumento({ base64Input: base64, mime: MIME_DOCX });
    assert.equal(res.ok, false);
    assert.equal(res.code, "extraction_failed");
  });

  test("extraerTextoDocumento: PDF corrupto/no válido devuelve extraction_failed, no revienta la petición", async () => {
    const base64 = Buffer.from("esto no es un pdf real").toString("base64");
    const res = await extraerTextoDocumento({ base64Input: base64, mime: MIME_PDF });
    assert.equal(res.ok, false);
    assert.equal(res.code, "extraction_failed");
  });
}
