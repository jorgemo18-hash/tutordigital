import sharp from "sharp";

export const HEIC_MIMES = new Set(["image/heic", "image/heif"]);
export const DNG_MIMES  = new Set(["image/x-adobe-dng", "image/dng"]);
// Todos los mimes que requieren conversión a JPEG antes de subir/OCR.
export const CONVERTIBLE_MIMES = new Set([...HEIC_MIMES, ...DNG_MIMES]);

const DNG_ERROR_MSG =
  "Formato DNG no soportado en este servidor. Convierte la foto a JPG antes de subirla.";

// Convierte un Buffer HEIC/HEIF/DNG a JPEG usando sharp/libvips.
// Si el entorno no tiene soporte RAW para DNG, lanza un error con mensaje
// claro en vez de propagar el error interno de libvips.
async function aJpegBuffer(buffer, mime) {
  try {
    return await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
  } catch (err) {
    if (DNG_MIMES.has(mime)) throw new Error(DNG_ERROR_MSG);
    throw err;
  }
}

// Convierte un Buffer HEIC/HEIF/DNG a JPEG. Para cualquier otro formato
// devuelve el buffer intacto. Siempre devuelve { buffer, mime }.
export async function convertirHeicBuffer(buffer, mime) {
  if (!CONVERTIBLE_MIMES.has(mime)) return { buffer, mime };
  const converted = await aJpegBuffer(buffer, mime);
  return { buffer: converted, mime: "image/jpeg" };
}

// Igual que convertirHeicBuffer pero opera sobre base64 puro (sin prefijo
// data URL). Usado por los endpoints de OCR y subida que reciben base64 en JSON.
export async function convertirHeicBase64(base64, mime) {
  if (!CONVERTIBLE_MIMES.has(mime)) return { base64, mime };
  const inBuf = Buffer.from(base64, "base64");
  const outBuf = await aJpegBuffer(inBuf, mime);
  return { base64: outBuf.toString("base64"), mime: "image/jpeg" };
}
