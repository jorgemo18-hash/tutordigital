// Las primitivas del script que saca del bucket público las fichas y las
// facturas (scripts/lib/storageMover.mjs).
//
// Los tres puntos con riesgo real, y por qué cada uno importa:
//
//   - LEER LA RUTA de la URL guardada. Si sale mal, se copia un archivo que
//     no existe; la comprobación de tamaño lo caza y el original NO se borra,
//     así que se rompe hacia el lado seguro — pero el archivo se queda
//     público, que es justo lo que había que quitar.
//   - DISTINGUIR CARPETA DE ARCHIVO en un listado de Storage. Una carpeta
//     tratada como archivo hace fallar el barrido de huérfanos.
//   - PAGINAR el listado. `list` devuelve como mucho 100 entradas: sin
//     paginar, un bucket con 150 archivos deja 50 públicos y el script
//     anuncia que ha terminado.
export async function run({ test, assert }) {
  const { rutaDesdeUrlPublica, esCarpeta, listarObjetos, moverObjeto } =
    await import("../../scripts/lib/storageMover.mjs");

  const BUCKET = "academia-assets";
  const base = `https://abc.supabase.co/storage/v1/object/public/${BUCKET}/`;

  // ── La ruta a partir de la URL ──────────────────────────────────────────

  test("saca la ruta de una URL pública normal", () => {
    assert.equal(rutaDesdeUrlPublica(`${base}t1/fichas/a9.jpg`, BUCKET), "t1/fichas/a9.jpg");
  });

  test("quita el ?v= que añadía cada subida", () => {
    // Dejarlo dentro buscaría en el bucket un archivo llamado
    // "a9.jpg?v=1757260000000" que no existe.
    assert.equal(rutaDesdeUrlPublica(`${base}t1/fichas/a9.jpg?v=1757260000000`, BUCKET), "t1/fichas/a9.jpg");
  });

  test("descodifica los caracteres escapados", () => {
    assert.equal(rutaDesdeUrlPublica(`${base}t1/gastos/factura%20marzo.pdf`, BUCKET), "t1/gastos/factura marzo.pdf");
  });

  test("una URL de OTRO bucket no se toca", () => {
    const otra = "https://abc.supabase.co/storage/v1/object/public/otro-bucket/x/y.jpg";
    assert.equal(rutaDesdeUrlPublica(otra, BUCKET), null);
  });

  test("null, vacío o basura devuelven null en vez de reventar", () => {
    assert.equal(rutaDesdeUrlPublica(null, BUCKET), null);
    assert.equal(rutaDesdeUrlPublica("", BUCKET), null);
    assert.equal(rutaDesdeUrlPublica("no soy una url", BUCKET), null);
    assert.equal(rutaDesdeUrlPublica(base, BUCKET), null, "la URL del bucket sin archivo detrás");
  });

  test("una ruta con % suelto no revienta: se devuelve tal cual", () => {
    assert.equal(rutaDesdeUrlPublica(`${base}t/gastos/100%.pdf`, BUCKET), "t/gastos/100%.pdf");
  });

  // ── Carpeta vs archivo ─────────────────────────────────────────────────

  test("una carpeta se reconoce por no tener id", () => {
    assert.equal(esCarpeta({ name: "88da1d9d", id: null }), true);
    assert.equal(esCarpeta({ name: "logo.png", id: "abc", metadata: { size: 20 } }), false);
  });

  // ── Paginación ─────────────────────────────────────────────────────────

  test("REGRESIÓN: listar pagina hasta el final, no se queda en los primeros 100", () => {
    // 150 archivos: sin paginar se devolverían 100 y 50 se quedarían
    // públicos sin que nadie se entere.
    const todos = Array.from({ length: 150 }, (_, i) => ({ name: `f${i}.jpg`, id: `id${i}` }));
    const admin = {
      storage: {
        from: () => ({
          list: async (_p, { limit, offset }) => ({ data: todos.slice(offset, offset + limit), error: null }),
        }),
      },
    };
    return listarObjetos(admin, BUCKET, "t/fichas").then((res) => {
      assert.equal(res.ok, true);
      assert.equal(res.entradas.length, 150);
    });
  });

  test("un error al listar se devuelve, no se traga como 'no hay nada'", () => {
    // Tragárselo haría que el barrido dijera "no queda nada" cuando en
    // realidad no ha podido mirar.
    const admin = { storage: { from: () => ({ list: async () => ({ data: null, error: { message: "sin permiso" } }) }) } };
    return listarObjetos(admin, BUCKET, "x").then((res) => {
      assert.equal(res.ok, false);
      assert.equal(res.motivo, "sin permiso");
    });
  });

  // ── Mover: copiar, comprobar, y solo entonces borrar ────────────────────

  function adminConTamanos({ origen, destino, errorCopia = null }) {
    const registro = { copias: [] };
    return {
      registro,
      storage: {
        from: (bucket) => ({
          list: async (_carpeta, { search }) => {
            const bytes = bucket === "academia-assets" ? origen : destino;
            return { data: bytes === null ? [] : [{ name: search, id: "x", metadata: { size: bytes } }], error: null };
          },
          copy: async (from, to, opts) => {
            registro.copias.push({ from, to, destino: opts?.destinationBucket });
            return { error: errorCopia };
          },
        }),
      },
    };
  }

  test("copia al bucket de destino y confirma cuando los tamaños cuadran", async () => {
    const admin = adminConTamanos({ origen: 1234, destino: 1234 });
    const res = await moverObjeto(admin, { origen: "academia-assets", destino: "academia-documentos", ruta: "t/fichas/a.jpg" });
    assert.equal(res.estado, "copiado");
    assert.deepEqual(admin.registro.copias, [{ from: "t/fichas/a.jpg", to: "t/fichas/a.jpg", destino: "academia-documentos" }]);
  });

  test("REGRESIÓN: si la copia no cuadra de tamaño, NO se da por movida", async () => {
    // Quien llama borra el original solo si esto dice "copiado". Un archivo
    // duplicado unos minutos no le hace daño a nadie; uno borrado antes de
    // estar copiado no vuelve.
    const admin = adminConTamanos({ origen: 1234, destino: 999 });
    const res = await moverObjeto(admin, { origen: "academia-assets", destino: "academia-documentos", ruta: "t/fichas/a.jpg" });
    assert.equal(res.estado, "fallo");
    assert.ok(res.motivo.includes("NO se borra"));
  });

  test("si el destino ni siquiera existe, tampoco se da por movida", async () => {
    const admin = adminConTamanos({ origen: 1234, destino: null });
    const res = await moverObjeto(admin, { origen: "academia-assets", destino: "academia-documentos", ruta: "t/fichas/a.jpg" });
    assert.equal(res.estado, "fallo");
  });

  test("'ya existe' no es un fallo: es la segunda pasada sobre el mismo archivo", async () => {
    const admin = adminConTamanos({ origen: 10, destino: 10, errorCopia: { message: "The resource already exists" } });
    const res = await moverObjeto(admin, { origen: "academia-assets", destino: "academia-documentos", ruta: "t/fichas/a.jpg" });
    assert.equal(res.estado, "copiado", "el script tiene que poder repetirse");
  });
}
