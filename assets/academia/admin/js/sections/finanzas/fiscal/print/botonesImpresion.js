import { buildIcon } from "../../../../icons.js";

// Fila con el botón "Descargar PDF" de un modelo fiscal — borde cobre,
// fondo transparente (.ac-btn.copper, ya existente en el panel),
// alineada a la derecha. Se deshabilita mientras imprime para que no se
// pueda disparar window.print() dos veces con un doble clic.
export function buildFilaDescargarPdf(onImprimir) {
  const fila = document.createElement("div");
  fila.className = "ac-fiscal-print-actions";
  fila.style.display = "flex";
  fila.style.justifyContent = "flex-end";
  fila.style.marginBottom = "18px";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn copper sm";
  btn.append(buildIcon("download", { size: 13 }), document.createTextNode(" Descargar PDF"));
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await onImprimir();
    } finally {
      btn.disabled = false;
    }
  });

  fila.appendChild(btn);
  return fila;
}
