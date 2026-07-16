import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

// fakeSupabaseAdmin.mjs no modela .storage (ningún test de este repo lo
// necesitaba hasta ahora) — se añade aquí encima del fake de tablas, con
// comportamiento configurable por test, en vez de tocar el fixture
// compartido para un caso de uso que solo usa este archivo.
function fakeBlob(buffer) {
  return { arrayBuffer: async () => buffer };
}

function conStorage(admin, { uploadError = null, downloadResult, removeCalls = [] } = {}) {
  admin.storage = {
    from() {
      return {
        upload: async () => ({ error: uploadError }),
        remove: async (paths) => {
          removeCalls.push(paths);
          return { error: null };
        },
        download: async () => downloadResult || { data: null, error: { message: "not found" } },
      };
    },
  };
  return admin;
}

export async function run({ test, assert }) {
  const { subirNormas, obtenerMetadataNormas, descargarArchivoNormas } = await import("../server/lib/academiaDocumentos/normas.js");

  test("subirNormas: mime no soportado se rechaza sin llegar a storage", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin());
    const res = await subirNormas(admin, "t1", { base64Input: "QQ==", mime: "image/png" });
    assert.equal(res.ok, false);
    assert.equal(res.code, "unsupported_mime");
  });

  test("subirNormas: base64 inválido se rechaza", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin());
    const res = await subirNormas(admin, "t1", { base64Input: "no-es-base64!!", mime: "application/pdf" });
    assert.equal(res.ok, false);
    assert.equal(res.code, "invalid_base64");
  });

  test("subirNormas: archivo por encima de 10MB se rechaza", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin());
    const enorme = "A".repeat(14_000_000); // ~10.5MB decodificado
    const res = await subirNormas(admin, "t1", { base64Input: enorme, mime: "application/pdf" });
    assert.equal(res.ok, false);
    assert.equal(res.code, "payload_too_large");
  });

  test("subirNormas: primera subida (sin documento previo) guarda path/mime en academia_config", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_config: [] }));
    const res = await subirNormas(admin, "tenant-1", { base64Input: "aG9sYQ==", mime: "application/pdf" });
    assert.equal(res.ok, true);
    const fila = admin._state.tables.academia_config.find((c) => c.tenant_id === "tenant-1");
    assert.equal(fila.normas_path, "tenant-1/normas.pdf");
    assert.equal(fila.normas_mime, "application/pdf");
    assert.ok(fila.normas_updated_at);
  });

  test("subirNormas: reemplazo con la MISMA extensión no borra nada en storage", async () => {
    const removeCalls = [];
    const admin = conStorage(
      makeFakeSupabaseAdmin({ academia_config: [{ tenant_id: "tenant-1", normas_path: "tenant-1/normas.pdf" }] }),
      { removeCalls }
    );
    const res = await subirNormas(admin, "tenant-1", { base64Input: "aG9sYQ==", mime: "application/pdf" });
    assert.equal(res.ok, true);
    assert.equal(removeCalls.length, 0, "misma ruta -> upsert basta, sin remove()");
  });

  test("subirNormas: reemplazo con OTRA extensión borra el archivo viejo del bucket", async () => {
    const removeCalls = [];
    const admin = conStorage(
      makeFakeSupabaseAdmin({ academia_config: [{ tenant_id: "tenant-1", normas_path: "tenant-1/normas.pdf" }] }),
      { removeCalls }
    );
    const res = await subirNormas(admin, "tenant-1", {
      base64Input: "aG9sYQ==",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    assert.equal(res.ok, true);
    assert.deepEqual(removeCalls, [["tenant-1/normas.pdf"]]);
    const fila = admin._state.tables.academia_config.find((c) => c.tenant_id === "tenant-1");
    assert.equal(fila.normas_path, "tenant-1/normas.docx");
  });

  test("subirNormas: fallo de storage.upload no toca la base de datos", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_config: [] }), { uploadError: { message: "boom" } });
    const res = await subirNormas(admin, "tenant-1", { base64Input: "aG9sYQ==", mime: "application/pdf" });
    assert.equal(res.ok, false);
    assert.equal(res.code, "upload_failed");
    assert.equal(admin._state.tables.academia_config?.length || 0, 0);
  });

  test("obtenerMetadataNormas: sin documento subido -> not_found", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_config: [{ tenant_id: "tenant-1" }] }));
    const res = await obtenerMetadataNormas(admin, "tenant-1");
    assert.equal(res.ok, false);
    assert.equal(res.code, "not_found");
  });

  test("obtenerMetadataNormas: con documento subido devuelve mime + updatedAt, sin url", async () => {
    const admin = conStorage(
      makeFakeSupabaseAdmin({
        academia_config: [{
          tenant_id: "tenant-1",
          normas_path: "tenant-1/normas.pdf",
          normas_mime: "application/pdf",
          normas_updated_at: "2026-07-01T00:00:00.000Z",
        }],
      })
    );
    const res = await obtenerMetadataNormas(admin, "tenant-1");
    assert.equal(res.ok, true);
    assert.equal(res.mime, "application/pdf");
    assert.equal(res.updatedAt, "2026-07-01T00:00:00.000Z");
    assert.equal(res.url, undefined, "ya no expone URL firmada de Storage");
  });

  test("descargarArchivoNormas: sin documento subido -> not_found", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_config: [{ tenant_id: "tenant-1" }] }));
    const res = await descargarArchivoNormas(admin, "tenant-1");
    assert.equal(res.ok, false);
    assert.equal(res.code, "not_found");
  });

  test("descargarArchivoNormas: descarga el buffer + mime almacenados", async () => {
    const buffer = Buffer.from("%PDF-1.4 fake");
    const admin = conStorage(
      makeFakeSupabaseAdmin({
        academia_config: [{ tenant_id: "tenant-1", normas_path: "tenant-1/normas.pdf", normas_mime: "application/pdf" }],
      }),
      { downloadResult: { data: fakeBlob(buffer), error: null } }
    );
    const res = await descargarArchivoNormas(admin, "tenant-1");
    assert.equal(res.ok, true);
    assert.ok(res.buffer.equals(buffer));
    assert.equal(res.mime, "application/pdf");
  });

  test("descargarArchivoNormas: fallo de storage.download -> download_failed, sin lanzar", async () => {
    const admin = conStorage(
      makeFakeSupabaseAdmin({
        academia_config: [{ tenant_id: "tenant-1", normas_path: "tenant-1/normas.pdf", normas_mime: "application/pdf" }],
      }),
      { downloadResult: { data: null, error: { message: "boom" } } }
    );
    const res = await descargarArchivoNormas(admin, "tenant-1");
    assert.equal(res.ok, false);
    assert.equal(res.code, "download_failed");
  });
}
