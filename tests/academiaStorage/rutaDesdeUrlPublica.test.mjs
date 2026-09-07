// Sacar la ruta del bucket a partir de la URL pública guardada.
//
// Es el único trozo del script de migración (scripts/migrar-archivos-privados.mjs)
// que se puede probar sin Storage, y es donde está el riesgo: si esto devuelve
// una ruta mal, el script copia un archivo que no existe, la comprobación de
// tamaño falla y —esto es lo importante— NO borra el original. Se rompe hacia
// el lado seguro, pero el archivo se queda público, que es justo lo que había
// que arreglar.
export async function run({ test, assert }) {
  const { rutaDesdeUrlPublica } = await import("../../scripts/migrar-archivos-privados.mjs");

  const base = "https://abc.supabase.co/storage/v1/object/public/academia-assets/";

  test("saca la ruta de una URL pública normal", () => {
    assert.equal(
      rutaDesdeUrlPublica(`${base}tenant-1/fichas/alumno-9.jpg`),
      "tenant-1/fichas/alumno-9.jpg"
    );
  });

  test("quita el ?v= que añade cada subida", () => {
    // subirArchivo.js le pegaba un `?v=<timestamp>` a la URL para saltarse la
    // caché del navegador. Dejarlo dentro de la ruta buscaría en el bucket un
    // archivo llamado "alumno-9.jpg?v=1725..." que no existe.
    assert.equal(
      rutaDesdeUrlPublica(`${base}tenant-1/fichas/alumno-9.jpg?v=1757260000000`),
      "tenant-1/fichas/alumno-9.jpg"
    );
  });

  test("descodifica los caracteres escapados", () => {
    assert.equal(
      rutaDesdeUrlPublica(`${base}tenant-1/gastos/factura%20marzo.pdf`),
      "tenant-1/gastos/factura marzo.pdf"
    );
  });

  test("una URL de OTRO bucket no se toca", () => {
    // Devolver una ruta aquí haría que el script copiara desde academia-assets
    // un archivo que en realidad vive en otro sitio.
    const otra = "https://abc.supabase.co/storage/v1/object/public/otro-bucket/x/y.jpg";
    assert.equal(rutaDesdeUrlPublica(otra), null);
  });

  test("null, vacío o basura devuelven null en vez de reventar", () => {
    // El script lo trata como "no se entiende esta URL" y deja la fila como
    // está, que es lo correcto: mejor un archivo sin migrar que uno perdido.
    assert.equal(rutaDesdeUrlPublica(null), null);
    assert.equal(rutaDesdeUrlPublica(""), null);
    assert.equal(rutaDesdeUrlPublica("no soy una url"), null);
    assert.equal(rutaDesdeUrlPublica(base), null, "la URL del bucket sin archivo detrás");
  });

  test("una ruta con % suelto no revienta: se devuelve tal cual", () => {
    // decodeURIComponent lanza con un "%" que no forma un escape válido.
    assert.equal(
      rutaDesdeUrlPublica(`${base}t/gastos/100%.pdf`),
      "t/gastos/100%.pdf"
    );
  });
}
