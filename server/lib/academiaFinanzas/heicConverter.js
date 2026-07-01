import sharp from "sharp";

export const HEIC_MIMES = new Set(["image/heic", "image/heif"]);

// Convierte un Buffer HEIC/HEIF a JPEG. Para cualquier otro formato devuelve
// el buffer intacto. Siempre devuelve { buffer, mime }.
export async function convertirHeicBuffer(buffer, mime) {
  if (!HEIC_MIMES.has(mime)) return { buffer, mime };
  const converted = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
  return { buffer: converted, mime: "image/jpeg" };
}

// Igual que convertirHeicBuffer pero opera sobre base64 puro (sin prefijo
// data URL). Usado por los endpoints de OCR y subida que reciben base64 en JSON.
export async function convertirHeicBase64(base64, mime) {
  if (!HEIC_MIMES.has(mime)) return { base64, mime };
  const inBuf = Buffer.from(base64, "base64");
  const outBuf = await sharp(inBuf).jpeg({ quality: 90 }).toBuffer();
  return { base64: outBuf.toString("base64"), mime: "image/jpeg" };
}
