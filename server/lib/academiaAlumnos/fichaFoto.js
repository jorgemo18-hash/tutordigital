import { subirFotoAdjunta, ALLOWED_FOTO_MIMES } from "../academiaStorage/fotoAdjunta.js";

export { ALLOWED_FOTO_MIMES };

// La ficha de inscripción en papel del alumno: la hoja que el admin
// fotografía para dar de alta. Hasta ahora se enviaba al OCR, se extraían
// los datos y la foto se tiraba — la academia se quedaba sin el documento
// original, que es justo lo que hay que poder enseñar si una familia
// discute lo que firmó.
//
// Se guarda igual que la factura de un gasto (misma implementación, ver
// academiaStorage/fotoAdjunta.js), en
// academia-documentos/{tenant}/fichas/{alumno_id}.{ext} —bucket PRIVADO,
// migración 114— y la ruta va a academia_alumnos.ficha_path. Antes iba al
// bucket público y lo que se guardaba era una URL que abría la hoja firmada
// de un menor sin ningún login.
export async function subirFichaAlumno(admin, { tenantId, id, base64Input, mime }) {
  return subirFotoAdjunta(admin, {
    tenantId,
    id,
    carpeta: "fichas",
    tabla: "academia_alumnos",
    columna: "ficha_path",
    base64Input,
    mime,
    mensajeMime: "Solo se aceptan imágenes JPG/PNG/WEBP/HEIC/DNG o PDF.",
  });
}
