// Guardar la ficha de inscripción en papel del alumno.
//
// Hasta ahora la hoja que el admin fotografía para dar de alta se enviaba al
// OCR, se sacaban los datos y la imagen se tiraba: la academia se quedaba
// sin el documento original. Se guarda igual que la factura de un gasto, y
// con la MISMA implementación (academiaStorage/fotoAdjunta.js) — copiarla
// habría dejado dos copias que se irían separando en cuanto cambiara un
// formato o un límite.
//
// LO QUE MÁS SE VIGILA AQUÍ ES DÓNDE ACABA EL ARCHIVO. Esta hoja lleva el
// nombre de un menor, su dirección y los teléfonos de sus padres. Estuvo
// meses en un bucket PÚBLICO, con su URL guardada en la base de datos: un
// enlace que abría el documento sin ningún login y que no caduca nunca
// (migración 114). Los tests de abajo son los que impiden que vuelva.
export async function run({ test, assert }) {
  const { subirFichaAlumno } = await import("../../server/lib/academiaAlumnos/fichaFoto.js");
  const { subirFotoGasto } = await import("../../server/lib/academiaFinanzas/gastoFoto.js");
  const { BUCKET_PRIVADO } = await import("../../server/lib/academiaStorage/archivoPrivado.js");

  // Fake con storage: fakeSupabaseAdmin no modela el bucket, y lo que hay
  // que comprobar aquí es exactamente a qué BUCKET y a qué ruta se sube, y
  // qué fila se actualiza.
  function adminFalso({ uploadError = null, updateError = null, rutaPrevia = null } = {}) {
    const registro = { subidas: [], updates: [], borrados: [], buckets: [], urlesPublicasPedidas: 0 };
    return {
      registro,
      storage: {
        from: (bucket) => {
          registro.buckets.push(bucket);
          return {
            upload: async (path, buf, opts) => {
              registro.subidas.push({ bucket, path, bytes: buf.length, contentType: opts?.contentType });
              return { error: uploadError };
            },
            remove: async (paths) => { registro.borrados.push(...paths); return { error: null }; },
            // Si alguien vuelve a usar esto para una ficha, el test lo canta.
            getPublicUrl: (path) => {
              registro.urlesPublicasPedidas += 1;
              return { data: { publicUrl: `https://cdn.test/${path}` } };
            },
          };
        },
      },
      from(tabla) {
        const fila = { tabla, filtros: [] };
        const builder = {
          select(cols) { fila.cols = cols; return builder; },
          update(patch) { fila.patch = patch; registro.updates.push(fila); return builder; },
          eq(col, val) { fila.filtros.push(`${col}=${val}`); return builder; },
          maybeSingle: async () => ({ data: rutaPrevia ? { ficha_path: rutaPrevia, foto_path: rutaPrevia } : null }),
          then(resolve) { return Promise.resolve({ error: updateError }).then(resolve); },
        };
        return builder;
      },
    };
  }

  const base64 = Buffer.from("contenido-de-la-ficha").toString("base64");
  const subidaDe = (admin) => admin.registro.subidas[0];
  const updateDe = (admin) => admin.registro.updates.find((u) => u.patch);

  test("LA FICHA VA AL BUCKET PRIVADO, no al de los assets públicos", async () => {
    // El logo del centro sí es público —va incrustado en los correos a las
    // familias—, y por eso el bucket público sigue existiendo. Esta hoja no.
    const admin = adminFalso();
    const res = await subirFichaAlumno(admin, {
      tenantId: "tenant-1", id: "alumno-9", base64Input: base64, mime: "image/jpeg",
    });

    assert.equal(res.ok, true);
    assert.equal(subidaDe(admin).bucket, BUCKET_PRIVADO);
    assert.equal(subidaDe(admin).bucket === "academia-assets", false, "academia-assets es público");
  });

  test("no se pide NINGUNA URL pública, y lo que se guarda es la ruta", async () => {
    const admin = adminFalso();
    const res = await subirFichaAlumno(admin, {
      tenantId: "tenant-1", id: "alumno-9", base64Input: base64, mime: "image/jpeg",
    });

    assert.equal(admin.registro.urlesPublicasPedidas, 0, "una URL pública es un enlace sin caducidad");
    assert.equal(res.path, "tenant-1/fichas/alumno-9.jpg");
    assert.equal(subidaDe(admin).path, "tenant-1/fichas/alumno-9.jpg");

    const update = updateDe(admin);
    assert.equal(update.tabla, "academia_alumnos");
    assert.ok("ficha_path" in update.patch, "se escribe ficha_path, no ficha_url");
    assert.equal(update.patch.ficha_path, "tenant-1/fichas/alumno-9.jpg");
    assert.equal("ficha_url" in update.patch, false, "la columna vieja no se toca");
  });

  test("el UPDATE va acotado por tenant, no solo por id", async () => {
    // Sin el filtro de tenant, un id de otro centro escribiría en su fila.
    const admin = adminFalso();
    await subirFichaAlumno(admin, { tenantId: "tenant-1", id: "alumno-9", base64Input: base64, mime: "image/jpeg" });
    const filtros = updateDe(admin).filtros;
    assert.ok(filtros.includes("id=alumno-9"));
    assert.ok(filtros.includes("tenant_id=tenant-1"));
  });

  test("un PNG conserva su extensión; un HEIC se guarda ya convertido a jpg", async () => {
    const png = adminFalso();
    await subirFichaAlumno(png, { tenantId: "t", id: "a", base64Input: base64, mime: "image/png" });
    assert.ok(subidaDe(png).path.endsWith(".png"));

    // HEIC/HEIF/DNG se convierten antes de subir: la extensión tiene que
    // decir lo que el archivo ES, no lo que llegó.
    const heic = adminFalso();
    const res = await subirFichaAlumno(heic, { tenantId: "t", id: "a", base64Input: base64, mime: "image/heic" });
    if (res.ok) assert.ok(subidaDe(heic).path.endsWith(".jpg"));
    else assert.equal(res.code, "conversion_failed", "si el servidor no puede convertir, lo dice");
  });

  test("reemplazar un JPG por un PDF borra el archivo viejo", async () => {
    // `upsert` sobrescribe la misma RUTA, y al cambiar la extensión la ruta
    // es otra: sin borrarlo, el JPG con los datos del menor se queda en el
    // bucket para siempre y sin ninguna fila que lo referencie — invisible.
    const admin = adminFalso({ rutaPrevia: "t/fichas/a.jpg" });
    await subirFichaAlumno(admin, { tenantId: "t", id: "a", base64Input: base64, mime: "application/pdf" });
    assert.deepEqual(admin.registro.borrados, ["t/fichas/a.jpg"]);
  });

  test("reemplazar un JPG por otro JPG NO borra nada", async () => {
    // Misma ruta: el borrado llegaría después del upsert y se cargaría el
    // archivo recién subido.
    const admin = adminFalso({ rutaPrevia: "t/fichas/a.jpg" });
    await subirFichaAlumno(admin, { tenantId: "t", id: "a", base64Input: base64, mime: "image/jpeg" });
    assert.deepEqual(admin.registro.borrados, []);
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

  test("si falla el bucket no se escribe la ruta en la ficha", async () => {
    const admin = adminFalso({ uploadError: new Error("bucket caído") });
    const res = await subirFichaAlumno(admin, { tenantId: "t", id: "a", base64Input: base64, mime: "image/jpeg" });
    assert.equal(res.ok, false);
    assert.equal(updateDe(admin), undefined, "una ruta apuntando a un archivo que no existe sería peor que nada");
  });

  test("REGRESIÓN: extraer el módulo común no ha movido la factura del gasto", async () => {
    // La ficha del alumno y la factura del gasto comparten implementación;
    // este test es la red para que compartirla no cambie el comportamiento
    // que ya estaba en producción.
    const admin = adminFalso();
    await subirFotoGasto(admin, { tenantId: "tenant-1", id: "gasto-3", base64Input: base64, mime: "application/pdf" });
    assert.equal(subidaDe(admin).path, "tenant-1/gastos/gasto-3.pdf");
    assert.equal(subidaDe(admin).bucket, BUCKET_PRIVADO, "la factura también es privada");
    assert.equal(updateDe(admin).tabla, "academia_gastos");
    assert.ok("foto_path" in updateDe(admin).patch);
  });
}
