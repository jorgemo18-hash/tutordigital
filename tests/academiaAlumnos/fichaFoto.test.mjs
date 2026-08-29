// Guardar la ficha de inscripción en papel del alumno.
//
// Hasta ahora la hoja que el admin fotografía para dar de alta se enviaba al
// OCR, se sacaban los datos y la imagen se tiraba: la academia se quedaba
// sin el documento original. Se guarda igual que la factura de un gasto, y
// con la MISMA implementación (academiaStorage/fotoAdjunta.js) — copiarla
// habría dejado dos copias que se irían separando en cuanto cambiara un
// formato o un límite.
export async function run({ test, assert }) {
  const { subirFichaAlumno } = await import("../../server/lib/academiaAlumnos/fichaFoto.js");
  const { subirFotoGasto } = await import("../../server/lib/academiaFinanzas/gastoFoto.js");

  // Fake con storage: fakeSupabaseAdmin no modela el bucket, y lo que hay
  // que comprobar aquí es exactamente a qué ruta se sube y qué fila se
  // actualiza.
  function adminFalso({ uploadError = null, updateError = null } = {}) {
    const registro = { subidas: [], updates: [] };
    return {
      registro,
      storage: {
        from: () => ({
          upload: async (path, buf, opts) => {
            registro.subidas.push({ path, bytes: buf.length, contentType: opts?.contentType });
            return { error: uploadError };
          },
          getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
        }),
      },
      from(tabla) {
        const fila = { tabla, filtros: [] };
        const builder = {
          update(patch) { fila.patch = patch; registro.updates.push(fila); return builder; },
          eq(col, val) { fila.filtros.push(`${col}=${val}`); return builder; },
          then(resolve) { return Promise.resolve({ error: updateError }).then(resolve); },
        };
        return builder;
      },
    };
  }

  const base64 = Buffer.from("contenido-de-la-ficha").toString("base64");

  test("la ficha va a {tenant}/fichas/{alumno}.jpg y su URL a academia_alumnos.ficha_url", async () => {
    const admin = adminFalso();
    const res = await subirFichaAlumno(admin, {
      tenantId: "tenant-1", id: "alumno-9", base64Input: base64, mime: "image/jpeg",
    });

    assert.equal(res.ok, true);
    assert.equal(admin.registro.subidas[0].path, "tenant-1/fichas/alumno-9.jpg");
    const update = admin.registro.updates[0];
    assert.equal(update.tabla, "academia_alumnos");
    assert.ok("ficha_url" in update.patch, "se escribe ficha_url, no otra columna");
    assert.ok(update.patch.ficha_url.startsWith("https://cdn.test/tenant-1/fichas/alumno-9.jpg"));
  });

  test("el UPDATE va acotado por tenant, no solo por id", async () => {
    // Sin el filtro de tenant, un id de otro centro escribiría en su fila.
    const admin = adminFalso();
    await subirFichaAlumno(admin, { tenantId: "tenant-1", id: "alumno-9", base64Input: base64, mime: "image/jpeg" });
    const filtros = admin.registro.updates[0].filtros;
    assert.ok(filtros.includes("id=alumno-9"));
    assert.ok(filtros.includes("tenant_id=tenant-1"));
  });

  test("un PNG conserva su extensión; un HEIC se guarda ya convertido a jpg", async () => {
    const png = adminFalso();
    await subirFichaAlumno(png, { tenantId: "t", id: "a", base64Input: base64, mime: "image/png" });
    assert.ok(png.registro.subidas[0].path.endsWith(".png"));

    // HEIC/HEIF/DNG se convierten antes de subir: la extensión tiene que
    // decir lo que el archivo ES, no lo que llegó.
    const heic = adminFalso();
    const res = await subirFichaAlumno(heic, { tenantId: "t", id: "a", base64Input: base64, mime: "image/heic" });
    if (res.ok) assert.ok(heic.registro.subidas[0].path.endsWith(".jpg"));
    else assert.equal(res.code, "conversion_failed", "si el servidor no puede convertir, lo dice");
  });

  test("un formato no admitido se rechaza antes de tocar el bucket", async () => {
    const admin = adminFalso();
    const res = await subirFichaAlumno(admin, {
      tenantId: "t", id: "a", base64Input: base64, mime: "application/zip",
    });
    assert.equal(res.ok, false);
    assert.equal(res.code, "unsupported_mime");
    assert.deepEqual(admin.registro.subidas, [], "no se sube nada");
  });

  test("si falla el bucket no se escribe la URL en la ficha", async () => {
    const admin = adminFalso({ uploadError: new Error("bucket caído") });
    const res = await subirFichaAlumno(admin, { tenantId: "t", id: "a", base64Input: base64, mime: "image/jpeg" });
    assert.equal(res.ok, false);
    assert.deepEqual(admin.registro.updates, [], "una ficha_url apuntando a un archivo que no existe sería peor que nada");
  });

  test("REGRESIÓN: extraer el módulo común no ha movido la factura del gasto", async () => {
    // La ficha del alumno y la factura del gasto comparten implementación;
    // este test es la red para que compartirla no cambie el comportamiento
    // que ya estaba en producción.
    const admin = adminFalso();
    await subirFotoGasto(admin, { tenantId: "tenant-1", id: "gasto-3", base64Input: base64, mime: "application/pdf" });
    assert.equal(admin.registro.subidas[0].path, "tenant-1/gastos/gasto-3.pdf");
    assert.equal(admin.registro.updates[0].tabla, "academia_gastos");
    assert.ok("foto_url" in admin.registro.updates[0].patch);
  });
}
