// Conversión HEIC/HEIF → JPEG en el propio navegador, sin pasar por el
// backend. Solo se usa cuando el OCR ya rechazó el archivo por tamaño
// (>5MB tras conversión) — el navegador decodifica el HEIC de forma nativa
// en el <img> (soportado en Safari/iOS) y lo volcamos a un <canvas> para
// reexportarlo como JPEG más ligero.
export function convertirHeicFileAJpeg(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El navegador no puede convertir este archivo."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("No se pudo convertir la imagen."));
            resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.92
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
