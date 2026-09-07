// Mover objetos de un bucket de Supabase Storage a otro, con red de
// seguridad. Lo usa scripts/migrar-archivos-privados.mjs.
//
// Vive aparte del script porque son dos responsabilidades distintas: aquí
// están las primitivas —leer la ruta de una URL, listar, copiar, comprobar,
// borrar—, y allí la decisión de QUÉ mover y en qué orden. Además así lo
// probable se puede probar sin Storage (ver tests/academiaStorage/).

// La ruta dentro del bucket, sacada de la URL pública guardada en la base de
// datos. La URL lleva un `?v=<timestamp>` que hay que quitar (lo añadía cada
// subida para saltarse la caché del navegador) y viene percent-encoded.
export function rutaDesdeUrlPublica(url, bucket) {
  const texto = String(url || "");
  const marca = `/object/public/${bucket}/`;
  const desde = texto.indexOf(marca);
  if (desde === -1) return null;
  const cruda = texto.slice(desde + marca.length).split("?")[0];
  if (!cruda) return null;
  try {
    return decodeURIComponent(cruda);
  } catch {
    // Un "%" suelto que no forma un escape válido hace lanzar a
    // decodeURIComponent. La ruta cruda es mejor que nada: si no existe, la
    // comprobación de tamaño lo detecta y el original NO se borra.
    return cruda;
  }
}

// En el listado de Storage, una CARPETA viene sin id y sin metadata. Es la
// única forma de distinguirla de un archivo, y confundirlas haría que el
// barrido intentara copiar una carpeta como si fuera un objeto.
export function esCarpeta(entrada) {
  return !entrada?.id;
}

function tamanoDe(entrada) {
  const bruto = entrada?.metadata?.size;
  return typeof bruto === "number" ? bruto : null;
}

// Todo lo que hay bajo un prefijo, paginado. `list` devuelve como mucho 100
// entradas por llamada y sin paginar se perderían archivos en silencio —
// que en un barrido de seguridad significa dejarlos públicos creyendo que
// no quedaba ninguno.
export async function listarObjetos(admin, bucket, prefijo, { pagina = 100 } = {}) {
  const encontrados = [];
  for (let offset = 0; ; offset += pagina) {
    const { data, error } = await admin.storage.from(bucket).list(prefijo, { limit: pagina, offset });
    if (error) return { ok: false, motivo: error.message };
    const lote = data || [];
    encontrados.push(...lote);
    if (lote.length < pagina) break;
  }
  return { ok: true, entradas: encontrados };
}

export async function tamanoEnBucket(admin, bucket, ruta) {
  const barra = ruta.lastIndexOf("/");
  const carpeta = barra === -1 ? "" : ruta.slice(0, barra);
  const nombre = barra === -1 ? ruta : ruta.slice(barra + 1);
  const { data, error } = await admin.storage.from(bucket).list(carpeta, { search: nombre, limit: 100 });
  if (error) return null;
  return tamanoDe((data || []).find((e) => e.name === nombre));
}

// Copia, COMPRUEBA y solo entonces borra el original.
//
// El orden es lo importante de esta función. Un archivo duplicado unos
// minutos no le hace daño a nadie; uno borrado antes de estar copiado no
// vuelve. Por eso el borrado va al final y solo si el destino existe y pesa
// exactamente lo mismo.
//
// Devuelve un estado, no un booleano: "movido", "sin_borrar" (copiado pero
// el original sigue vivo — hay que gritarlo, es justo lo que se venía a
// quitar) y "fallo".
export async function moverObjeto(admin, { origen, destino, ruta }) {
  const bytesOrigen = await tamanoEnBucket(admin, origen, ruta);

  const { error: errCopia } = await admin.storage
    .from(origen)
    .copy(ruta, ruta, { destinationBucket: destino });
  // Un "ya existe" es una segunda pasada sobre el mismo archivo: no es un
  // fallo, se sigue y la comprobación de tamaño de abajo decide.
  if (errCopia && !/exist/i.test(errCopia.message || "")) {
    return { estado: "fallo", motivo: `no se pudo copiar (${errCopia.message})` };
  }

  const bytesDestino = await tamanoEnBucket(admin, destino, ruta);
  if (bytesDestino === null || (bytesOrigen !== null && bytesDestino !== bytesOrigen)) {
    return { estado: "fallo", motivo: `la copia no cuadra (${bytesOrigen} → ${bytesDestino}). NO se borra el original.` };
  }

  return { estado: "copiado" };
}

export async function borrarObjeto(admin, bucket, ruta) {
  const { error } = await admin.storage.from(bucket).remove([ruta]);
  return error ? { ok: false, motivo: error.message } : { ok: true };
}
