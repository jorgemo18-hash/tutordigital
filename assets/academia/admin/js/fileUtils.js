// Lee un File del input[type=file] como base64 puro (sin el prefijo
// "data:...;base64,") — usado por cualquier subida de imagen del panel
// admin (ficha de inscripción, logo, foto de fondo).
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}
