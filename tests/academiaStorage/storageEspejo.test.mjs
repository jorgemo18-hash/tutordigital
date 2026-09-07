// El espejo de Supabase Storage: qué se baja y qué no (scripts/lib/storageEspejo.mjs).
//
// Es la copia de seguridad de los ARCHIVOS —las fichas de inscripción
// escaneadas, las facturas— que el pg_dump no cubre. Lo que se prueba aquí
// son las dos decisiones que no se pueden equivocar:
//
//   - CUÁNDO HAY QUE VOLVER A BAJAR ALGO. Si dice que no de más, la copia se
//     queda con una versión vieja de una ficha reemplazada y nadie lo nota.
//     Si dice que sí de más, se bajan 135 MB cada lunes.
//   - DÓNDE SE ESCRIBE. Una ruta con ".." dentro sacaría la escritura de la
//     carpeta de copias.
export async function run({ test, assert }) {
  const { rutaLocalDe, hayQueDescargar, listarBucketEntero } =
    await import("../../scripts/lib/storageEspejo.mjs");

  // ── Dónde se escribe ───────────────────────────────────────────────────

  test("el archivo va a <destino>/<bucket>/<ruta>", () => {
    assert.equal(
      rutaLocalDe("/copias/storage", "academia-documentos", "t1/fichas/a9.jpg"),
      "/copias/storage/academia-documentos/t1/fichas/a9.jpg"
    );
  });

  test("SEGURIDAD: una ruta con '..' no saca la escritura de la carpeta de copias", () => {
    // El nombre viene del servidor. Sin limpiarlo, un objeto llamado
    // "../../.ssh/authorized_keys" escribiría fuera del destino.
    assert.equal(
      rutaLocalDe("/copias/storage", "b", "../../etc/passwd"),
      "/copias/storage/b/etc/passwd"
    );
    assert.equal(rutaLocalDe("/copias/storage", "b", "a/./b//c.jpg"), "/copias/storage/b/a/b/c.jpg");
  });

  // ── Cuándo hay que bajar ───────────────────────────────────────────────

  const AYER = "2026-09-06T10:00:00Z";
  const HOY = "2026-09-07T10:00:00Z";
  const localDe = (bytes, iso) => ({ bytes, mtimeMs: Date.parse(iso) });

  test("si no está en la copia, se baja", () => {
    assert.equal(hayQueDescargar({ local: null, bytesRemotos: 100, actualizadoRemoto: HOY }), true);
  });

  test("si está igual, NO se vuelve a bajar", () => {
    // Es lo que evita bajarse 135 MB cada lunes.
    assert.equal(
      hayQueDescargar({ local: localDe(100, HOY), bytesRemotos: 100, actualizadoRemoto: HOY }),
      false
    );
  });

  test("REGRESIÓN: una ficha reemplazada por otra del MISMO tamaño se vuelve a bajar", () => {
    // Mirar solo el tamaño dejaría en la copia la foto vieja para siempre.
    assert.equal(
      hayQueDescargar({ local: localDe(100, AYER), bytesRemotos: 100, actualizadoRemoto: HOY }),
      true
    );
  });

  test("REGRESIÓN: una descarga cortada a medias se rehace, aunque la fecha cuadre", () => {
    // Mirar solo la fecha daría por buena media foto.
    assert.equal(
      hayQueDescargar({ local: localDe(40, HOY), bytesRemotos: 100, actualizadoRemoto: HOY }),
      true
    );
  });

  test("unos milisegundos de diferencia no cuentan como cambio", () => {
    // Los sistemas de archivos no siempre guardan los milisegundos: sin
    // margen, el mismo archivo se bajaría todas las semanas.
    const local = { bytes: 100, mtimeMs: Date.parse(HOY) - 400 };
    assert.equal(hayQueDescargar({ local, bytesRemotos: 100, actualizadoRemoto: HOY }), false);
  });

  test("sin fecha remota, manda el tamaño", () => {
    assert.equal(hayQueDescargar({ local: localDe(100, HOY), bytesRemotos: 100, actualizadoRemoto: null }), false);
    assert.equal(hayQueDescargar({ local: localDe(99, HOY), bytesRemotos: 100, actualizadoRemoto: null }), true);
  });

  // ── Recorrer el bucket entero ──────────────────────────────────────────

  function adminConArbol(arbol) {
    return {
      storage: {
        from: () => ({
          list: async (prefijo, { offset }) => {
            if (offset > 0) return { data: [], error: null };
            return { data: arbol[prefijo] || [], error: null };
          },
        }),
      },
    };
  }
  const carpeta = (name) => ({ name, id: null });
  const archivo = (name, size) => ({ name, id: `id-${name}`, metadata: { size }, updated_at: HOY });

  test("entra en las carpetas: Storage no tiene carpetas de verdad, son prefijos", () => {
    const admin = adminConArbol({
      "": [carpeta("t1"), archivo("logo.png", 20)],
      t1: [carpeta("fichas")],
      "t1/fichas": [archivo("a9.jpg", 100), archivo("b2.jpg", 200)],
    });
    return listarBucketEntero(admin, "b").then((res) => {
      assert.equal(res.ok, true);
      assert.deepEqual(res.objetos.map((o) => o.ruta).sort(), ["logo.png", "t1/fichas/a9.jpg", "t1/fichas/b2.jpg"]);
      assert.equal(res.objetos.find((o) => o.ruta === "t1/fichas/a9.jpg").bytes, 100);
    });
  });

  test("una carpeta que se contiene a sí misma no deja el backup dando vueltas", () => {
    // Una respuesta rara del servidor a las 9 de la mañana de un lunes, sin
    // nadie mirando, es exactamente cuando no puede quedarse colgado.
    const admin = {
      storage: { from: () => ({ list: async (p, { offset }) => ({ data: offset > 0 ? [] : [carpeta("x")], error: null }) }) },
    };
    return listarBucketEntero(admin, "b").then((res) => {
      assert.equal(res.ok, false);
      assert.ok(res.motivo.includes("niveles"));
    });
  });

  test("un error al listar se propaga: no se da por bueno un bucket a medias", () => {
    const admin = { storage: { from: () => ({ list: async () => ({ data: null, error: { message: "sin permiso" } }) }) } };
    return listarBucketEntero(admin, "b").then((res) => {
      assert.equal(res.ok, false);
      assert.equal(res.motivo, "sin permiso");
    });
  });
}
