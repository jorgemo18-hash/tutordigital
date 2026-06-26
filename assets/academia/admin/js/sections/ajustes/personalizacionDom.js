// Aplica logo/fondo a los elementos ya presentes en el DOM en el momento
// de subir la imagen, para que se vea el cambio sin recargar la página.
// .ac-photo vive fuera de Ajustes (academiaAdmin.js lo crea una vez al
// arrancar el panel, ver buildLayout) y .ef-preview-logo solo existe si la
// preview de un recibo está montada en ese momento (sección Envío a
// familias) — si ninguno está en el DOM ahora, no hacen nada.
export function aplicarFondoGlobal(bgUrl) {
  if (!bgUrl) return;
  document.querySelectorAll(".ac-photo").forEach((el) => {
    el.style.backgroundImage = `url('${bgUrl}')`;
  });
}

export function aplicarLogoGlobal(logoUrl) {
  if (!logoUrl) return;
  document.querySelectorAll(".ef-preview-logo").forEach((img) => {
    img.src = logoUrl;
  });
}
