import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

// fakeSupabaseAdmin.mjs no modela .storage (ningún test de este repo lo
// necesitaba hasta ahora) — se añade aquí encima del fake de tablas, con
// comportamiento configurable por test, en vez de tocar el fixture
// compartido para un caso de uso que solo usa este archivo.
function conStorage(admin, { uploadError = null, signedUrl, signedUrlError = null, removeCalls = [] } = {}) {
  admin.storage = {
    from() {
      return {
        upload: async () => ({ error: uploadError }),
        remove: async (paths) => {
          removeCalls.push(paths);
          return { error: null };
        },
        createSignedUrl: async (path, ttl) =>
          signedUrlError
            ? { data: null, error: signedUrlError }
            : { data: { signedUrl: signedUrl || `https://fake.local/${path}?ttl=${ttl}` }, error: null },
      };
    },
  };
  return admin;
}

export async function run({ test, assert }) {
  const { buildHojaInscripcionPayload } = await import("../server/lib/academiaDocumentos/payload.js");
  const { subirNormas, obtenerUrlNormas } = await import("../server/lib/academiaDocumentos/normas.js");

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
    });
  });

  test("buildHojaInscripcionPayload: usa tenantNombre como fallback y vacíos si falta el resto", () => {
    const payload = buildHojaInscripcionPayload({}, "Mi Academia");
    assert.deepEqual(payload, { nombre: "Mi Academia", ciudad: "", logo_url: "", iban: "", bizum_emisor: "" });
  });

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

  test("obtenerUrlNormas: sin documento subido -> not_found", async () => {
    const admin = conStorage(makeFakeSupabaseAdmin({ academia_config: [{ tenant_id: "tenant-1" }] }));
    const res = await obtenerUrlNormas(admin, "tenant-1");
    assert.equal(res.ok, false);
    assert.equal(res.code, "not_found");
  });

  test("obtenerUrlNormas: con documento subido devuelve URL firmada + mime", async () => {
    const admin = conStorage(
      makeFakeSupabaseAdmin({
        academia_config: [{
          tenant_id: "tenant-1",
          normas_path: "tenant-1/normas.pdf",
          normas_mime: "application/pdf",
          normas_updated_at: "2026-07-01T00:00:00.000Z",
        }],
      }),
      { signedUrl: "https://fake.local/signed" }
    );
    const res = await obtenerUrlNormas(admin, "tenant-1");
    assert.equal(res.ok, true);
    assert.equal(res.url, "https://fake.local/signed");
    assert.equal(res.mime, "application/pdf");
    assert.equal(res.updatedAt, "2026-07-01T00:00:00.000Z");
  });

  test("obtenerUrlNormas: fallo al firmar la URL -> signed_url_failed", async () => {
    const admin = conStorage(
      makeFakeSupabaseAdmin({ academia_config: [{ tenant_id: "tenant-1", normas_path: "tenant-1/normas.pdf" }] }),
      { signedUrlError: { message: "boom" } }
    );
    const res = await obtenerUrlNormas(admin, "tenant-1");
    assert.equal(res.ok, false);
    assert.equal(res.code, "signed_url_failed");
  });
}
