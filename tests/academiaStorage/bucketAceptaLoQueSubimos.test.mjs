import fs from "node:fs";
import path from "node:path";

// Lo que el código sube tiene que caber en lo que el bucket acepta.
//
// EL FALLO (leído en producción el 11/09/2026, no deducido). Subir la ficha
// de un alumno respondía 500 "No se pudo subir el archivo" siempre que era
// una foto. En los logs de Storage:
//
//   POST /object/academia-documentos/{tenant}/fichas/{alumno}.jpg -> 400
//   errorCode "InvalidMimeType"
//   message   "mime type image/jpeg is not supported"
//
// El bucket `academia-documentos` lo creó la migración 086 para las normas
// del centro (PDF o DOCX). La 114 metió ahí la ficha del alumno y la factura
// del gasto, que son FOTOS, y no amplió `allowed_mime_types`. Dos
// declaraciones de la misma verdad —la lista del código y la lista del
// bucket— que discreparon en silencio durante meses.
//
// POR QUÉ NADIE LO VIO. En el bucket hay 38 fichas y 14 facturas en JPG/PNG.
// Todas del 07/09/2026, el día en que corrió
// scripts/migrar-archivos-privados.mjs — que usa storage.copy(), y copy NO
// valida `allowed_mime_types`. Los archivos entraron por la puerta que no
// comprueba; la que comprueba nunca dejó pasar una imagen.
//
// Y POR QUÉ NO SE PUDO DIAGNOSTICAR DESDE EL SERVIDOR: el error de Storage se
// tiraba a la basura (`return { code: "upload_failed" }` sin log). Arreglado
// también, ver traducirErrorDeStorage.
//
// ESTE TEST compara las dos listas: los mimes que de verdad llegan a Storage
// contra los que la última migración declara para el bucket, y el límite de
// tamaño del código contra el del bucket. Si alguien añade un formato en un
// sitio y no en el otro, falla aquí y no en producción tres meses después.
const RAIZ = new URL("../../", import.meta.url).pathname;
const DIR_MIGRACIONES = path.join(RAIZ, "supabase/migrations");
const BUCKET = "academia-documentos";

// Los comentarios `--` se quitan ANTES de buscar. Si no, cualquier migración
// que EXPLIQUE una lista de mimes en su cabecera (la 117 lo hace, citando la
// lista vieja para contar qué estaba mal) la cuela como si fuera la
// declaración vigente. Pasó al escribir este test: leía la lista del
// comentario y daba por bueno un bucket que ya estaba arreglado.
function sinComentarios(sql) {
  return sql.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
}

// La última migración que declara algo sobre este bucket es la que manda: el
// test no puede fijarse en un número concreto, porque mañana habrá otra. Y
// dentro de un mismo archivo, la última sentencia.
function ultimaDeclaracion(regex) {
  const archivos = fs.readdirSync(DIR_MIGRACIONES)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort();
  let encontrado = null;
  let enArchivo = null;
  for (const archivo of archivos) {
    const sql = sinComentarios(fs.readFileSync(path.join(DIR_MIGRACIONES, archivo), "utf8"));
    // Solo los bloques que hablan de ESTE bucket.
    if (!sql.includes(BUCKET)) continue;
    for (const m of sql.matchAll(new RegExp(regex, "g"))) {
      encontrado = m[1];
      enArchivo = archivo;
    }
  }
  return { valor: encontrado, archivo: enArchivo };
}

export async function run({ test, assert }) {
  const { ALLOWED_FOTO_MIMES, MAX_FOTO_BYTES } = await import(
    "../../server/lib/academiaStorage/fotoAdjunta.js"
  );
  const { CONVERTIBLE_MIMES } = await import(
    "../../server/lib/academiaStorage/heicConverter.js"
  );
  const { traducirErrorDeStorage } = await import(
    "../../server/lib/academiaStorage/archivoPrivado.js"
  );

  // HEIC, HEIF y DNG NUNCA llegan a Storage: se convierten a JPEG antes
  // (heicConverter.js). Por eso el bucket no tiene por qué aceptarlos, y por
  // eso la lista que hay que comparar no es ALLOWED_FOTO_MIMES tal cual.
  const mimesQueLleganAStorage = new Set(
    [...ALLOWED_FOTO_MIMES].map((m) => (CONVERTIBLE_MIMES.has(m) ? "image/jpeg" : m))
  );

  const declaracionMimes = ultimaDeclaracion(/allowed_mime_types[^[]*\[([^\]]+)\]/);
  const mimesDelBucket = new Set(
    (declaracionMimes.valor || "")
      .split(",")
      .map((s) => s.trim().replace(/^'|'$/g, ""))
      .filter(Boolean)
  );

  test("el barrido encuentra la declaración del bucket (si no, no prueba nada)", () => {
    assert.ok(
      declaracionMimes.archivo,
      "ninguna migración declara allowed_mime_types para este bucket: ¿se ha renombrado?"
    );
    assert.ok(mimesDelBucket.size >= 2, `solo ${mimesDelBucket.size} mimes leídos`);
  });

  test("REGRESIÓN: el bucket acepta TODOS los formatos que el backend le manda", () => {
    const rechazados = [...mimesQueLleganAStorage].filter((m) => !mimesDelBucket.has(m));
    assert.deepEqual(
      rechazados, [],
      `el backend sube estos y Storage los rechaza con InvalidMimeType (400): ${rechazados.join(", ")}. ` +
      `Añádelos a allowed_mime_types en una migración nueva, o quítalos de ALLOWED_FOTO_MIMES.`
    );
  });

  test("image/jpeg está en la lista, que es el formato al que se convierte todo", () => {
    // El caso concreto que falló. Si alguien reordena la lista y se lo lleva
    // por delante, HEIC y DNG dejan de poder subirse aunque nadie los nombre.
    assert.ok(mimesDelBucket.has("image/jpeg"));
  });

  test("REGRESIÓN: el límite del código no promete más de lo que el bucket admite", () => {
    // El bucket se crea con `insert ... (id, name, public, file_size_limit,
    // allowed_mime_types) values (...)`, así que el número no va pegado al
    // nombre de la columna: se coge el primer entero grande del values.
    const limiteBucket = Number(
      (ultimaDeclaracion(/file_size_limit\s*=\s*(\d+)/).valor
        || ultimaDeclaracion(/,\s*(\d{6,})\s*,/).valor
        || "").replace(/_/g, "")
    );
    assert.ok(limiteBucket > 0, "no se ha podido leer file_size_limit de ninguna migración");
    assert.ok(
      MAX_FOTO_BYTES <= limiteBucket,
      `MAX_FOTO_BYTES (${MAX_FOTO_BYTES}) supera el límite del bucket (${limiteBucket}): ` +
      `un archivo entre los dos pasa la comprobación del código y muere en Storage con un 500 ciego`
    );
  });

  // ── Que el error deje de ser ciego ────────────────────────────────────

  test("un mime rechazado por Storage se traduce a 415, no a 500", () => {
    const r = traducirErrorDeStorage(
      { error: "invalid_mime_type", message: "mime type image/jpeg is not supported" },
      "image/jpeg"
    );
    assert.equal(r.code, "unsupported_mime", "las rutas mapean este código a 415");
    assert.match(r.motivo, /image\/jpeg/, "el mime tiene que salir en el mensaje: es el dato accionable");
  });

  test("un archivo demasiado grande para el bucket se traduce a 413", () => {
    const r = traducirErrorDeStorage({ message: "The object exceeded the maximum allowed size" });
    assert.equal(r.code, "payload_too_large");
  });

  test("cualquier otro fallo sigue siendo upload_failed, pero LLEVA el error dentro", () => {
    // Esta es la parte que faltaba: el error original viaja en el resultado
    // para que la ruta lo escriba en su log.
    const original = { message: "socket hang up" };
    const r = traducirErrorDeStorage(original);
    assert.equal(r.code, "upload_failed");
    assert.equal(r.error, original, "sin esto, el 500 vuelve a no dejar rastro");
  });

  test("REGRESIÓN: las dos rutas de subida escriben el error en el log", () => {
    for (const rel of [
      "server/routes/v1/academia.alumnos.ficha.routes.js",
      "server/routes/v1/academia-finanzas/gastosFoto.routes.js",
    ]) {
      const src = fs.readFileSync(path.join(RAIZ, rel), "utf8");
      assert.match(
        src, /req\.log\.error\(\s*\{\s*err:\s*resultado\.error/,
        `${rel} devuelve el fallo sin registrarlo: eso es lo que hizo invisible este bug`
      );
    }
  });
}
