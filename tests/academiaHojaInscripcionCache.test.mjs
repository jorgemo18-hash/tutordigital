// fakeSupabaseAdmin.mjs no modela .storage — se construye aquí un doble
// mínimo con download/upload/list/remove configurables, igual criterio
// que academiaDocumentosNormas.test.mjs (storage.upload/remove/createSignedUrl).
function fakeBlob(buffer) {
  return { arrayBuffer: async () => buffer };
}

function fakeAdminConStorage({
  downloadResult = { data: null, error: { message: "not found" } },
  uploadError = null,
  listResult = { data: [], error: null },
  removeCalls = [],
  listCalls = [],
} = {}) {
  return {
    storage: {
      from() {
        return {
          download: async () => downloadResult,
          upload: async () => ({ error: uploadError }),
          list: async (path, opts) => {
            listCalls.push({ path, opts });
            return listResult;
          },
          remove: async (paths) => {
            removeCalls.push(paths);
            return { error: null };
          },
        };
      },
    },
  };
}

export async function run({ test, assert }) {
  const { calcularHashHojaInscripcion } = await import("../server/lib/academiaDocumentos/hashHojaInscripcion.js");
  const { leerCacheHojaInscripcion, guardarCacheHojaInscripcion } = await import(
    "../server/lib/academiaDocumentos/hojaInscripcionCache.js"
  );

  test("calcularHashHojaInscripcion: mismo contenido, distinto orden de claves -> mismo hash", () => {
    const a = { nombre: "Lyceo", campos: { alumno: { curso: true, dni: false } } };
    const b = { campos: { alumno: { dni: false, curso: true } }, nombre: "Lyceo" };
    assert.equal(calcularHashHojaInscripcion(a), calcularHashHojaInscripcion(b));
  });

  test("calcularHashHojaInscripcion: contenido distinto -> hash distinto", () => {
    const a = { nombre: "Lyceo", texto_legal: "" };
    const b = { nombre: "Lyceo", texto_legal: "Texto nuevo" };
    assert.notEqual(calcularHashHojaInscripcion(a), calcularHashHojaInscripcion(b));
  });

  test("calcularHashHojaInscripcion: determinista — misma llamada, mismo resultado siempre", () => {
    const payload = { a: 1, b: { c: 2, d: [3, 4] } };
    assert.equal(calcularHashHojaInscripcion(payload), calcularHashHojaInscripcion(payload));
  });

  test("calcularHashHojaInscripcion: es un hex de 64 caracteres (sha256)", () => {
    const hash = calcularHashHojaInscripcion({ x: 1 });
    assert.equal(hash.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(hash));
  });

  test("leerCacheHojaInscripcion: hit — devuelve el buffer descargado", async () => {
    const buffer = Buffer.from("%PDF-1.4 fake");
    const admin = fakeAdminConStorage({ downloadResult: { data: fakeBlob(buffer), error: null } });
    const res = await leerCacheHojaInscripcion(admin, "tenant-1", "hash-abc");
    assert.equal(res.ok, true);
    assert.ok(res.buffer.equals(buffer));
  });

  test("leerCacheHojaInscripcion: miss (no existe) — ok:false sin lanzar", async () => {
    const admin = fakeAdminConStorage({ downloadResult: { data: null, error: { message: "not found" } } });
    const res = await leerCacheHojaInscripcion(admin, "tenant-1", "hash-abc");
    assert.equal(res.ok, false);
  });

  test("leerCacheHojaInscripcion: Storage inalcanzable (lanza) — degrada a ok:false, no revienta la petición", async () => {
    const admin = {
      storage: {
        from() {
          return { download: async () => { throw new Error("network down"); } };
        },
      },
    };
    const res = await leerCacheHojaInscripcion(admin, "tenant-1", "hash-abc");
    assert.equal(res.ok, false);
    assert.ok(res.error);
  });

  test("guardarCacheHojaInscripcion: primera subida, sin versiones previas — no borra nada", async () => {
    const removeCalls = [];
    const admin = fakeAdminConStorage({ listResult: { data: [], error: null }, removeCalls });
    const res = await guardarCacheHojaInscripcion(admin, "tenant-1", "hash-nuevo", Buffer.from("pdf"));
    assert.equal(res.ok, true);
    assert.equal(removeCalls.length, 0);
  });

  test("guardarCacheHojaInscripcion: borra versiones anteriores del mismo tenant, conserva la nueva", async () => {
    const removeCalls = [];
    const admin = fakeAdminConStorage({
      listResult: {
        data: [
          { name: "hoja-inscripcion-hash-viejo.pdf" },
          { name: "hoja-inscripcion-hash-nuevo.pdf" },
        ],
        error: null,
      },
      removeCalls,
    });
    const res = await guardarCacheHojaInscripcion(admin, "tenant-1", "hash-nuevo", Buffer.from("pdf"));
    assert.equal(res.ok, true);
    assert.equal(removeCalls.length, 1);
    assert.deepEqual(removeCalls[0], ["tenant-1/hoja-inscripcion-hash-viejo.pdf"]);
  });

  test("guardarCacheHojaInscripcion: fallo al subir — ok:false, nunca intenta limpiar", async () => {
    const listCalls = [];
    const admin = fakeAdminConStorage({ uploadError: { message: "boom" }, listCalls });
    const res = await guardarCacheHojaInscripcion(admin, "tenant-1", "hash-x", Buffer.from("pdf"));
    assert.equal(res.ok, false);
    assert.equal(listCalls.length, 0);
  });

  test("guardarCacheHojaInscripcion: fallo en la limpieza de versiones viejas no es fatal — ok:true igual", async () => {
    const admin = {
      storage: {
        from() {
          return {
            upload: async () => ({ error: null }),
            list: async () => { throw new Error("list falla"); },
            remove: async () => ({ error: null }),
          };
        },
      },
    };
    const res = await guardarCacheHojaInscripcion(admin, "tenant-1", "hash-x", Buffer.from("pdf"));
    assert.equal(res.ok, true);
  });
}
