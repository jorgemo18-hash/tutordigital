import { subirArchivoPrivado, borrarArchivoPrivado } from "./archivoPrivado.js";
import { convertirHeicBase64 } from "./heicConverter.js";

// Adjuntar una foto/PDF a una fila del centro y guardar su RUTA en la tabla
// que sea. Lo usan la factura de un gasto (academia_gastos.foto_path) y la
// ficha de inscripción de un alumno (academia_alumnos.ficha_path): mismo
// bucket, mismas conversiones, mismos límites y mismos códigos de error.
//
// Estaba escrito solo para gastos. Al añadir la ficha del alumno había dos
// opciones: copiarlo entero o extraerlo. Copiado, cualquier arreglo futuro
// (un formato nuevo, un límite distinto, un fallo de conversión) habría que
// hacerlo dos veces y una de las dos se quedaría atrás.
//
// ESTOS DOS ARCHIVOS SON PRIVADOS (migración 114). Antes se subían al bucket
// público `academia-assets` y lo que se guardaba era su URL pública, que abre
// el documento sin ningún login: la hoja de inscripción firmada de un menor a
// un enlace de distancia, para siempre y sin caducidad. Ahora van al bucket
// privado y lo que se guarda es la ruta; el archivo se sirve proxied por una
// ruta autenticada. El logo del centro sigue siendo público, y con razón: va
// incrustado en los correos a las familias.

export const MAX_FOTO_BYTES = 31_457_280; // 30 MB — igual que el bodyLimit global de Fastify

// HEIC/HEIF/DNG se convierten a JPEG antes de subir, por eso su extensión es "jpg".
const EXT_POR_MIME = {
  "image/jpeg":        "jpg",
  "image/png":         "png",
  "image/webp":        "webp",
  "application/pdf":   "pdf",
  "image/heic":        "jpg",
  "image/heif":        "jpg",
  "image/x-adobe-dng": "jpg",
  "image/dng":         "jpg",
};
export const ALLOWED_FOTO_MIMES = new Set(Object.keys(EXT_POR_MIME));

export function rutaAdjunto({ tenantId, carpeta, id, mime }) {
  return `${tenantId}/${carpeta}/${id}.${EXT_POR_MIME[mime]}`;
}

// Sube a academia-documentos/{tenant}/{carpeta}/{id}.{ext} y escribe la ruta
// en `tabla`.`columna` de esa fila (acotada por tenant, nunca por id a
// secas). Si el servidor no tiene soporte RAW para un DNG, el converter lanza
// con un mensaje claro que llega al cliente como 422.
//
// `columna` es la de la RUTA (ficha_path / foto_path). La columna vieja de
// URL pública no se toca: la limpia el script de migración cuando mueve el
// archivo que ya estuviera subido.
export async function subirFotoAdjunta(admin, {
  tenantId, id, carpeta, tabla, columna, base64Input, mime, mensajeMime,
}) {
  if (!ALLOWED_FOTO_MIMES.has(mime)) {
    return { ok: false, code: "unsupported_mime", motivo: mensajeMime || "Formato de archivo no admitido." };
  }

  let b64Final, mimeFinal;
  try {
    ({ base64: b64Final, mime: mimeFinal } = await convertirHeicBase64(base64Input, mime));
  } catch (err) {
    return { ok: false, code: "conversion_failed", motivo: err.message };
  }

  // La ruta anterior, para poder borrarla si la extensión cambia (una ficha
  // en JPG reemplazada por un PDF): `upsert` sobrescribe la misma ruta, pero
  // con otra extensión la ruta es otra y el archivo viejo se quedaría
  // huérfano en el bucket, con datos de un menor y sin nada que lo referencie.
  const { data: filaPrevia } = await admin
    .from(tabla)
    .select(columna)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const rutaPrevia = filaPrevia?.[columna] || null;

  const path = rutaAdjunto({ tenantId, carpeta, id, mime });
  const subida = await subirArchivoPrivado(admin, {
    path, base64Input: b64Final, mime: mimeFinal, maxBytes: MAX_FOTO_BYTES,
  });
  if (!subida.ok) return subida;

  const { error: dbErr } = await admin
    .from(tabla)
    .update({ [columna]: subida.path })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (dbErr) return { ok: false, code: "db_update_failed", motivo: "No se pudo guardar el archivo en la ficha." };

  if (rutaPrevia && rutaPrevia !== subida.path) await borrarArchivoPrivado(admin, rutaPrevia);

  return { ok: true, path: subida.path };
}
